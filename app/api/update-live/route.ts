// Refreshes the granular live_games table for every game currently marked LIVE,
// and upserts the same games' events into `play_by_play`.
// Intended to be triggered on a schedule (see vercel.json).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const NHL_PLAYBYPLAY_URL = 'https://api-web.nhle.com/v1/gamecenter';

interface LiveGameRow {
  nhl_game_id: number;
  home_score: number | null;
  away_score: number | null;
  period: number | null;
  seconds_left: number | null;
  clock_running: boolean | null;
  in_intermission: boolean | null;
  away_id: number;
  home_id: number;
  home_sog: number;
  away_sog: number;
}

// Raw play-by-play from endpoint
interface NHLPlay {
  periodDescriptor?: { number?: number };
  timeInPeriod?: string;
  typeDescKey?: string;
  sortOrder?: number;
  details?: Record<string, unknown> & { eventOwnerTeamId?: number };
}

// One row in the `play_by_play` table.
export interface PlayRow {
  nhl_game_id: number;
  period_number: number | null;
  period_time: string | null;
  team_id: number | null;
  description: string | null;
  details: Record<string, unknown> | null;
  sort_order: number | null;
}

interface GameData {
  live: LiveGameRow;
  plays: PlayRow[];
}

async function fetchLiveInfo(nhlGameId: number): Promise<GameData> {
  const res = await fetch(`${NHL_PLAYBYPLAY_URL}/${nhlGameId}/play-by-play`, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'BluelineHockeyApp/1.0 (https://github.com/lukakona/hockey)',
    },
    cache: 'no-store', // Always fetch fresh data
  });

  if (!res.ok) {
    throw new Error(`NHL API error status: ${res.status} for game ${nhlGameId}`);
  }

  const data = await res.json();

  const live: LiveGameRow = {
    nhl_game_id: data.id,
    home_score: data.homeTeam?.score ?? null,
    away_score: data.awayTeam?.score ?? null,
    period: data.periodDescriptor?.number ?? null,
    seconds_left: data.clock?.secondsRemaining ?? null,
    clock_running: data.clock?.running ?? null,
    in_intermission: data.clock?.inIntermission ?? null,
    away_id: data.awayTeam?.id,
    home_id: data.homeTeam?.id,
    away_sog: data.awayTeam?.sog,
    home_sog: data.homeTeam?.sog,
  };

  // The event list accumulates as the game progresses, so re-runs upsert over it.
  const plays: PlayRow[] = ((data.plays ?? []) as NHLPlay[])
    .map((p) => ({
      nhl_game_id: nhlGameId,
      period_number: p.periodDescriptor?.number ?? null,
      period_time: p.timeInPeriod ?? null,
      team_id: p.details?.eventOwnerTeamId ?? null,
      // typeDescKey selects the label template; the raw `details` object holds
      // the values ({scoringPlayerId}, {shotType}, ...) used to fill it in.
      description: p.typeDescKey ?? null,
      details: p.details ?? null,
      sort_order: p.sortOrder ?? null,
    }))
    // sort_order doubles as the upsert conflict key, so drop anything missing it.
    .filter((p) => p.sort_order !== null);

  return { live, plays };
}

function dedupeBy<T>(rows: T[], key: (row: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(key(row), row);
  return [...byKey.values()];
}

export async function GET(req: NextRequest) {
  try {
    // cron header
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Check live games, we only retrieve those.
    const { data: liveGames, error: liveError } = await supabase
      .from('games')
      .select('nhl_game_id')
      .eq('status', 'LIVE');

    if (liveError) {
      console.error('Supabase Read Error:', liveError.message);
      return NextResponse.json({ error: liveError.message }, { status: 500 });
    }

    if (!liveGames || liveGames.length === 0) {
      return NextResponse.json({ success: true, synced_count: 0, live_games: [] });
    }

    const results = await Promise.allSettled(
      liveGames.map((g: { nhl_game_id: number }) => fetchLiveInfo(g.nhl_game_id))
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Live fetch failed for game ${liveGames[i].nhl_game_id}:`, r.reason);
      }
    });

    const fetched = results.filter(
      (r): r is PromiseFulfilledResult<GameData> => r.status === 'fulfilled'
    );

    const rows = dedupeBy(
      fetched.map((r) => r.value.live),
      (r) => String(r.nhl_game_id)
    );
    const plays = dedupeBy(
      fetched.flatMap((r) => r.value.plays),
      (p) => `${p.nhl_game_id}:${p.sort_order}`
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'All live game fetches failed' }, { status: 502 });
    }

    const { data: upsertedData, error } = await supabase
      .from('live_games')
      .upsert(rows, { onConflict: 'nhl_game_id' })
      .select();

    if (error) {
      console.error('Supabase Upsert Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let playsUpserted = 0;
    if (plays.length > 0) {
      const { data: playData, error: playError } = await supabase
        .from('play_by_play')
        .upsert(plays, { onConflict: 'nhl_game_id,sort_order' })
        .select();

      if (playError) {
        console.error('Supabase Play-by-Play Upsert Error:', playError.message);
        return NextResponse.json({ error: playError.message }, { status: 500 });
      }

      playsUpserted = playData?.length || 0;
    }

    return NextResponse.json({
      success: true,
      synced_count: upsertedData?.length || 0,
      plays_synced_count: playsUpserted,
      failed_count: results.length - rows.length,
      live_games: upsertedData,
    });
  } catch (err) {
    console.error('Live Game Sync Failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
