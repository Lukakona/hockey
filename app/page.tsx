'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import BlueskyLoginModal from '@/components/BlueskyLogin';
import NHLWeekDay from '@/components/NHLWeekDay';
import Footer from '@/components/Footer';
import InfoModal from '@/components/InfoModal';

import banner from '@/img/blueline bannerish.png';
import LeaderboardPanel from '@/components/Leaderboard';
import Shoutbox from '@/components/Shoutbox';
import FullGameDetails from '@/components/FullGameDetails';

export interface Game {
  id: string;
  nhl_game_id: number;
  home_team: string;
  home_city: string;
  home_icon: string;
  home_radio: string;
  away_team: string;
  away_city: string;
  away_icon: string;
  away_radio: string;
  status: string;
  period_info: string;
  score: string;
  start_utc: string;
  venue: string;
}

// Raw row from the granular `live_games` table
export interface LiveGame {
  id?: string;
  nhl_game_id: number;
  home_score: number | null;
  away_score: number | null;
  period: number | null;
  seconds_left: number | null;
  in_intermission: boolean | null;
  updated_at?: string;
  home_id: number;
  away_id: number;
  home_sog: number;
  away_sog: number;
  clock_running: boolean | false;
}

// Row from the `teams` table (populated by /api/get-standings)
export interface Team {
  id: string;
  team_name: string;
  place: string | null;
  abbreviation: string | null;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  ties: number | null;
}

// A scheduled game enriched with its live detail (when available) and the
// resolved team rows for both sides.
export interface EnrichedGame extends Game {
  live: LiveGame | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
}

type ActiveView = 'games' | 'myteams' | 'idleteam' | 'fullgame';

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieVal = parts.pop()?.split(';').shift();
    return cookieVal ? decodeURIComponent(cookieVal) : null;
  }
  return null;
}

// Collapse live_games rows into a single latest row per game id
function toLiveMap(rows: LiveGame[]): Record<number, LiveGame> {
  const map: Record<number, LiveGame> = {};
  for (const row of rows) {
    const prev = map[row.nhl_game_id];
    const prevTime = prev?.updated_at ? Date.parse(prev.updated_at) : 0;
    const rowTime = row.updated_at ? Date.parse(row.updated_at) : 0;
    if (!prev || rowTime >= prevTime) {
      map[row.nhl_game_id] = row;
    }
  }
  return map;
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [liveGames, setLiveGames] = useState<Record<number, LiveGame>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<{
    id: string;
    handle: string;
    avatar: string;
    did: string;
  } | null>(null);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('games');
  const [loading, setLoading] = useState<boolean>(true);
  const [balance, setBalance] = useState<number>(0);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Look up a team row by name (games.home_team/away_team match teams.team_name)
  const teamsByName = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.team_name, t);
    return map;
  }, [teams]);

  // Single source of truth for rendering: schedule rows joined with live detail
  // and the resolved home/away team rows.
  const enrichedGames = useMemo<EnrichedGame[]>(
    () =>
      games.map((g) => ({
        ...g,
        live: liveGames[g.nhl_game_id] ?? null,
        homeTeam: teamsByName.get(g.home_team) ?? null,
        awayTeam: teamsByName.get(g.away_team) ?? null,
      })),
    [games, liveGames, teamsByName]
  );

  // Derive the selected game from its id so it re-renders with fresh polling data
  const selectedGame = useMemo(
    () => enrichedGames.find((g) => g.nhl_game_id === selectedGameId) ?? null,
    [enrichedGames, selectedGameId]
  );

  const fetchGames = useCallback(async (): Promise<Game[] | null> => {
    const start_of_day = new Date(viewDate);
    start_of_day.setHours(0, 0, 0, 0);

    const end_of_day = new Date(viewDate);
    end_of_day.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .gte('start_utc', start_of_day.toISOString())
      .lte('start_utc', end_of_day.toISOString())
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching games:', error.message);
      return null;
    }
    return data;
  }, [supabase, viewDate]);

  const fetchLiveGames = useCallback(async (): Promise<Record<number, LiveGame> | null> => {
    const { data, error } = await supabase.from('live_games').select('*');
    if (error) {
      console.error('Error fetching live games:', error.message);
      return null;
    }
    return data ? toLiveMap(data as LiveGame[]) : null;
  }, [supabase]);

  const fetchTeams = useCallback(async (): Promise<Team[] | null> => {
    const { data, error } = await supabase.from('teams').select('*');
    if (error) {
      console.error('Error fetching teams:', error.message);
      return null;
    }
    return data as Team[];
  }, [supabase]);

  useEffect(() => {
    async function loadUserData() {
      // 1. Read URL params or cookies for identity
      const searchParams = new URLSearchParams(window.location.search);
      const urlHandle = searchParams.get('handle');
      const urlDid = searchParams.get('did');
      const urlAvatar = searchParams.get('avatar');

      const handle = urlHandle || getCookie('bsky_handle');
      const did = urlDid || getCookie('bsky_did');
      const avatar = urlAvatar || getCookie('bsky_avatar') || '';

      // If new login, persist cookies & clean address bar
      if (urlHandle && urlDid) {
        document.cookie = `bsky_handle=${encodeURIComponent(urlHandle)}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `bsky_did=${encodeURIComponent(urlDid)}; path=/; max-age=604800; SameSite=Lax`;
        if (urlAvatar) {
          document.cookie = `bsky_avatar=${encodeURIComponent(urlAvatar)}; path=/; max-age=604800; SameSite=Lax`;
        }
        window.history.replaceState({}, '', window.location.pathname);
      }

      if (!did) {
        setLoading(false);
        return;
      }

      // 2. Fetch the latest balance & profile data from Supabase using bsky_did
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, balance, username, avatar_url')
        .eq('bsky_did', did)
        .maybeSingle();

      if (error) {
        console.error('Error fetching balance:', error.message);
      }

      const userBalance = profile?.balance ?? 0;

      // 3. Update component states
      setBalance(userBalance);
      setUserProfile({
        id: profile?.id ?? '',
        did,
        handle: profile?.username || handle || '',
        avatar: profile?.avatar_url || avatar || '',
      });

      setLoading(false);
    }

    async function refreshGames() {
      const [gamesData, liveData, teamsData] = await Promise.all([
        fetchGames(),
        fetchLiveGames(),
        fetchTeams(),
      ]);
      if (gamesData) setGames(gamesData);
      if (liveData) setLiveGames(liveData);
      if (teamsData) setTeams(teamsData);
    }

    refreshGames();
    loadUserData();
  }, [fetchGames, fetchLiveGames, fetchTeams, supabase]);

  // Keep the schedule rows fresh so status flips FUT -> LIVE -> FINAL without a
  // manual reload. sync-games only runs every 15 min, so a couple of minutes is plenty.
  useEffect(() => {
    const isToday = new Date().toDateString() === viewDate.toDateString();
    if (!isToday) return;

    const id = setInterval(
      async () => {
        const data = await fetchGames();
        if (data) setGames(data);
      },
      2 * 60 * 1000
    );
    return () => clearInterval(id);
  }, [fetchGames, viewDate]);

  // Poll the granular live data while any game is in progress
  useEffect(() => {
    const hasLiveGames = games.some((g) => g.status === 'LIVE' || g.status === 'CRIT');
    if (!hasLiveGames) return;

    const id = setInterval(async () => {
      const data = await fetchLiveGames();
      if (data) setLiveGames(data);
    }, 60000);
    return () => clearInterval(id);
  }, [games, fetchLiveGames]);

  return (
    <div className="flex min-h-screen flex-col bg-blue-50 font-sans text-blue-100">
      {/* 1. HEADER */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-4 border-slate-900 bg-blue-400/50 px-6 py-4 backdrop-blur">
        <div></div>
        <div className="flex items-center gap-3">
          <Image src={banner} alt="BlueLine"></Image>
        </div>

        {!userProfile?.handle && (
          <button
            onClick={() => setIsLoginOpen(true)}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-blue-950 transition hover:bg-cyan-400"
          >
            Login with Bluesky
          </button>
        )}
        {userProfile?.handle && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border-2 border-slate-900 bg-blue-800/20 px-4 py-1.5">
              <span className="font-bold text-amber-400">⚫</span>
              <span className="font-bold text-amber-200">{balance.toLocaleString()}</span>
              <span className="text-s font-extrabold text-slate-800">PUCKS</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-cyan-600 text-sm font-bold">
              <img
                src={userProfile.avatar}
                alt={userProfile.handle}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
      </header>

      {/* 2. BODY LAYOUT */}
      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-12">
        {/* LEFT NAV SIDEBAR */}
        <nav className="hidden flex-col gap-2 lg:col-span-2 lg:flex">
          <button
            onClick={() => setActiveView('games')}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition ${
              activeView === 'games'
                ? 'border-2 border-slate-900 bg-blue-500/10 text-slate-900'
                : 'text-slate-900 hover:bg-blue-500/10'
            }`}
          >
            🏒 All Games
          </button>
          <button
            onClick={() => setActiveView('myteams')}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition ${
              activeView === 'myteams'
                ? 'border-2 border-slate-900 bg-blue-500/10 text-slate-900'
                : 'text-slate-900 hover:bg-blue-500/10'
            }`}
          >
            👥 My Teams
          </button>
          <button
            onClick={() => setActiveView('idleteam')}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition ${
              activeView === 'idleteam'
                ? 'border-2 border-slate-900 bg-blue-500/10 text-slate-900'
                : 'text-slate-900 hover:bg-blue-500/10'
            }`}
          >
            ⏳ Fantasy Idle
          </button>
        </nav>

        {/* MAIN DASHBOARD CONTENT */}
        <main className="flex flex-col gap-6 lg:col-span-6">
          {activeView === 'games' && (
            <NHLWeekDay
              games={enrichedGames}
              date={viewDate}
              balance={balance}
              placeBet={(wager: number) => setBalance((prev) => prev - wager)}
              changeDate={(days: number) => {
                setViewDate((prev) => {
                  const newDate = new Date(prev);
                  newDate.setDate(prev.getDate() + days);
                  return newDate;
                });
              }}
              selectGame={(gameId: number) => {
                setSelectedGameId(gameId);
                setActiveView('fullgame');
              }}
            />
          )}

          {activeView === 'fullgame' && selectedGame && <FullGameDetails game={selectedGame} />}

          {activeView === 'myteams' && (
            <h2 className="text-base font-bold text-black">"my teams" is not finished yet :-)</h2>
          )}

          {activeView === 'idleteam' && (
            <h2 className="text-base font-bold text-black">
              "fantasy idle" is not finished yet :-)
            </h2>
          )}
        </main>

        {/* RIGHT SOCIAL SIDEBAR */}
        <aside className="flex flex-col gap-6 lg:col-span-4">
          <LeaderboardPanel></LeaderboardPanel>

          <Shoutbox userProfile={userProfile}></Shoutbox>
        </aside>
      </div>

      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <BlueskyLoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <Footer onInfoClick={() => setIsInfoOpen(true)} />
    </div>
  );
}
