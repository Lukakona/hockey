// src/app/api/sync-nhl/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Authorization Secret header (CRON_SECRET)
    const authHeader = req.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch live scores & schedule from the official NHL API with a custom User-Agent
    const res = await fetch('https://api-web.nhle.com/v1/score/now', {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BluelineHockeyApp/1.0 (https://github.com/blueline)',
      },
      cache: 'no-store', // Always fetch fresh data
    });

    if (!res.ok) {
      throw new Error(`NHL API error status: ${res.status}`);
    }

    const data = await res.json();
    const nhlGames = data.games || [];

    if (nhlGames.length === 0) {
      return NextResponse.json({ message: 'No games scheduled for today.' });
    }

    // 3. Map NHL API payload to match Supabase 'games' schema
    const formattedGames = nhlGames.map((g: any) => {
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
        home_team: g.homeTeam.name?.default || g.homeTeam.commonName?.default || 'Home',
        away_team: g.awayTeam.name?.default || g.awayTeam.commonName?.default || 'Away',
        status: status,
        period_info: periodInfo,
        score: `${g.homeTeam.score ?? 0} - ${g.awayTeam.score ?? 0}`,
        updated_at: new Date().toISOString(),
      };
    });

    // 4. Upsert games into Supabase
    const supabase = await createClient();
    const { data: upsertedData, error } = await supabase
      .from('games')
      .upsert(formattedGames, { onConflict: 'nhl_game_id' })
      .select();

    if (error) {
      console.error('Supabase Upsert Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      synced_count: upsertedData?.length || 0,
      games: upsertedData,
    });
  } catch (err: any) {
    console.error('NHL Sync Failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}