// Queries the full schedule for the week. We can do this once a week to write to the database, so we only store this weeks games.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const data = await res.json();
    console.log(data.gameWeek);
    const gamesThisWeek = data.gameWeek.flatMap((day: any) => day.games) || [];

    if (gamesThisWeek.length === 0) {
      return NextResponse.json({ message: 'No games scheduled.' });
    }

    // gameWeek property has all games for the week
    const formattedGames = gamesThisWeek.map((g: any) => {
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

    // cleanse games before the upsert, so we dont keep stale data
    const supabase = await createClient();
    const { error: deleteError } = await supabase.from('games').delete().neq('nhl_game_id', 0);

    if(deleteError){
      console.error('Supabase Delete Error: ', deleteError.message);
      return NextResponse.json({error: deleteError.message}, {status: 500})
    }
    const { data: insertedData, error } = await supabase
      .from('games')
      .insert(formattedGames)
      .select();

    if (error) {
      console.error('Supabase Insert Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      synced_count: insertedData?.length || 0,
      games: insertedData,
    });
  } catch (err: any) {
    console.error('NHL Sync Failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}