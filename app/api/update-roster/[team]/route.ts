// Syncs a single NHL team's current roster into `players` (upsert, then prune
// anyone no longer on the roster).
// Hit as /api/update-roster/{TEAM} — e.g. /api/update-roster/PIT.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const NHL_ROSTER_URL = 'https://api-web.nhle.com/v1/roster';
const SEASON = '20262027';

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'BluelineHockeyApp/1.0 (https://github.com/lukakona/hockey)',
};

interface NHLPlayer {
  id: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
}

interface NHLRosterResponse {
  forwards: NHLPlayer[];
  defensemen: NHLPlayer[];
  goalies: NHLPlayer[];
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ team: string }> }) {
  try {
    // cron header
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { team } = await params;
    const teamCode = team?.toUpperCase();

    if (!teamCode || !/^[A-Z]{3}$/.test(teamCode)) {
      return NextResponse.json({ error: `Invalid team code: ${team}` }, { status: 400 });
    }

    const res = await fetch(`${NHL_ROSTER_URL}/${teamCode}/${SEASON}`, {
      headers: HEADERS,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`NHL API error status: ${res.status} for ${teamCode}`);
    }

    const data = (await res.json()) as NHLRosterResponse;
    const roster = [...(data.forwards ?? []), ...(data.defensemen ?? []), ...(data.goalies ?? [])];

    if (roster.length === 0) {
      return NextResponse.json({ message: `No players found for ${teamCode}.` });
    }

    const players = roster.map((p) => ({
      id: p.id,
      team_code: teamCode,
      headshot: p.headshot,
      first_name: p.firstName?.default ?? null,
      last_name: p.lastName?.default ?? null,
    }));

    const supabase = await createClient();

    const { data: upsertedData, error: upsertError } = await supabase
      .from('players')
      .upsert(players, { onConflict: 'id' })
      .select();

    if (upsertError) {
      console.error('Supabase Upsert Error:', upsertError.message);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const rosterIds = players.map((p) => p.id);
    const { error: pruneError } = await supabase
      .from('players')
      .delete()
      .eq('team_code', teamCode)
      .not('id', 'in', `(${rosterIds.join(',')})`);

    if (pruneError) {
      console.error('Supabase Prune Error:', pruneError.message);
      return NextResponse.json({ error: pruneError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      team: teamCode,
      synced_count: upsertedData?.length || 0,
      players: upsertedData,
    });
  } catch (err) {
    console.error('NHL Roster Sync Failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
