// Refreshes the granular live_games table for every game currently marked LIVE.
// Intended to be triggered on a schedule (see vercel.json).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const NHL_BOXSCORE_URL = 'https://api-web.nhle.com/v1/gamecenter';

interface LiveGameRow {
  nhl_game_id: number;
  home_score: number | null;
  away_score: number | null;
  period: number | null;
  seconds_left: number | null;
  in_intermission: boolean | null;
}

async function fetchBoxscore(nhlGameId: number): Promise<LiveGameRow> {
  const res = await fetch(`${NHL_BOXSCORE_URL}/${nhlGameId}/boxscore`, {
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

  return {
    nhl_game_id: data.id,
    home_score: data.homeTeam?.score ?? null,
    away_score: data.awayTeam?.score ?? null,
    period: data.periodDescriptor?.number ?? null,
    seconds_left: data.clock?.secondsRemaining ?? null,
    in_intermission: data.clock?.inIntermission ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    // cron header
    const authHeader = req.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // 1. Which games are live right now?
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

    // 2. Fetch every live boxscore in parallel so one failure can't kill the batch
    const results = await Promise.allSettled(
      liveGames.map((g: { nhl_game_id: number }) => fetchBoxscore(g.nhl_game_id))
    );

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Live fetch failed for game ${liveGames[i].nhl_game_id}:`, r.reason);
      }
    });

    const rows = results
      .filter((r): r is PromiseFulfilledResult<LiveGameRow> => r.status === 'fulfilled')
      .map((r) => r.value);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'All live game fetches failed' },
        { status: 502 }
      );
    }

    // 3. Upsert one row per game (requires a unique constraint on nhl_game_id)
    const { data: upsertedData, error } = await supabase
      .from('live_games')
      .upsert(rows, { onConflict: 'nhl_game_id' })
      .select();

    if (error) {
      console.error('Supabase Upsert Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      synced_count: upsertedData?.length || 0,
      failed_count: results.length - rows.length,
      live_games: upsertedData,
    });
  } catch (err) {
    console.error('Live Game Sync Failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}