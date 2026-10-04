// Queries the current standings to update the teams DB
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface NHLTeam {
  placeName: { default: string };
  teamCommonName: { default: string };
  teamAbbrev: { default: string };
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
}

interface NHLStandingsResponse {
  standings: NHLTeam[];
}

export async function GET(req: NextRequest) {
  try {
    // cron header
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch('https://api-web.nhle.com/v1/standings/now', {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BluelineHockeyApp/1.0 (https://github.com/lukakona/hockey)',
      },
      cache: 'no-store', // Always fetch fresh data
    });

    if (!res.ok) {
      throw new Error(`NHL API error status: ${res.status}`);
    }

    const data = (await res.json()) as NHLStandingsResponse;
    const teams = data.standings ?? [];

    if (teams.length === 0) {
      return NextResponse.json({ message: 'No games retrieved.' });
    }

    const formattedTeams = teams.map((t) => {
      return {
        team_name: t.teamCommonName.default,
        place: t.placeName.default,
        abbreviation: t.teamAbbrev.default,
        games_played: t.gamesPlayed,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
      };
    });

    const supabase = await createClient();

    // Upsert the teams
    const { data: upsertedData, error } = await supabase
      .from('teams')
      .upsert(formattedTeams, { onConflict: 'team_name' })
      .select();

    if (error) {
      console.error('Supabase Upsert Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      synced_count: upsertedData?.length || 0,
      teams: upsertedData,
    });
  } catch (err) {
    console.error('NHL Team Sync Failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
