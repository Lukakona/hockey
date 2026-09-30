// Queries the full schedule for the week and upserts it into `games`.
// Upserting on nhl_game_id keeps row ids stable across runs (no empty-table
// window, no id churn), then we prune anything that dropped out of the week.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface NhlScheduleGame {
  id: number;
  gameState: string;
  startTimeUTC: string;
  venue: { default: string };
  periodDescriptor?: { number?: number };
  clock?: { timeRemaining?: string };
  homeTeam: {
    commonName: { default: string };
    logo: string;
    radioLink: string;
  };
  awayTeam: {
    commonName: { default: string };
    logo: string;
    radioLink: string;
  };
}

interface NhlScheduleResponse {
  gameWeek?: Array<{ games: NhlScheduleGame[] }>;
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

    // Retrieves the full schedule for the week
    const res = await fetch('https://api-web.nhle.com/v1/schedule/now', {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BluelineHockeyApp/1.0 (https://github.com/lukakona/hockey)',
      },
      cache: 'no-store', // Always fetch fresh data
    });

    if (!res.ok) {
      throw new Error(`NHL API error status: ${res.status}`);
    }

    const data = (await res.json()) as NhlScheduleResponse;
    const gamesThisWeek = data.gameWeek?.flatMap((day) => day.games) ?? [];

    if (gamesThisWeek.length === 0) {
      return NextResponse.json({ message: 'No games scheduled.' });
    }

    // gameWeek property has all games for the week
    const formattedGames = gamesThisWeek.map((g) => {
      // Game states: 'FUT' (Future/Scheduled), 'LIVE', 'OFF' / 'FINAL'
      const status = g.gameState;

      let periodInfo = 'Scheduled';
      if (status === 'LIVE') {
        periodInfo = `P${g.periodDescriptor?.number || 1} - ${g.clock?.timeRemaining || 'In Progress'}`;
      } else if (status === 'OFF' || status === 'FINAL') {
        periodInfo = 'Final';
      }

      return {
        nhl_game_id: g.id,
        venue: g.venue.default,
        start_utc: g.startTimeUTC,
        home_team: g.homeTeam.commonName.default,
        home_icon: g.homeTeam.logo,
        home_radio: g.homeTeam.radioLink,
        away_team: g.awayTeam.commonName.default,
        away_icon: g.awayTeam.logo,
        away_radio: g.awayTeam.radioLink,
        status: status,
        updated_at: new Date().toISOString(),
      };
    });

    const supabase = await createClient();

    // Upsert the current week's games; existing rows keep their id
    const { data: upsertedData, error } = await supabase
      .from('games')
      .upsert(formattedGames, { onConflict: 'nhl_game_id' })
      .select();

    if (error) {
      console.error('Supabase Upsert Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Prune anything that dropped out of the current week (i.e. last week's games)
    const currentIds = formattedGames.map((g) => g.nhl_game_id);
    const { error: pruneError } = await supabase
      .from('games')
      .delete()
      .not('nhl_game_id', 'in', `(${currentIds.join(',')})`);

    if (pruneError) {
      console.error('Supabase Prune Error:', pruneError.message);
      return NextResponse.json({ error: pruneError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      synced_count: upsertedData?.length || 0,
      games: upsertedData,
    });
  } catch (err) {
    console.error('NHL Sync Failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}