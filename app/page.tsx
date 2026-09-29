'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import BlueskyLoginModal from '@/components/BlueskyLogin';
import NHLWeekDay from '@/components/NHLWeekDay';
import Footer from '@/components/Footer';
import InfoModal from '@/components/InfoModal';

import banner from '@/img/blueline bannerish.png';
import LeaderboardPanel from '@/components/Leaderboard';

export interface Game {
  id: string;
  nhl_game_id: number;
  home_team: string;
  home_icon: string;
  home_radio: string;
  away_team: string;
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
}

// A scheduled game enriched with its live detail (when available)
export interface EnrichedGame extends Game {
  live: LiveGame | null;
}

type ActiveView = 'games' | 'myteams' | 'idleteam';

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
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<{ handle: string; avatar: string; did: string } | null>(null);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('games');
  const [loading, setLoading] = useState<boolean>(true);
  const [balance, setBalance] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState([
    { user: 'the chatter@bsky.social', text: "I'm using tilt controls!" },
    { user: 'ImprisonedBeast@darkness.zone', text: 'aaaaaah let me out of here' },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const supabase = useMemo(() => createClient(), []);

  // Single source of truth for rendering: schedule rows joined with live detail
  const enrichedGames = useMemo<EnrichedGame[]>(
    () => games.map((g) => ({ ...g, live: liveGames[g.nhl_game_id] ?? null })),
    [games, liveGames]
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const sender = userProfile ? `@${userProfile.handle}` : 'You';
    setChatMessages((prev) => [...prev, { user: sender, text: newMessage }]);
    setNewMessage('');
  };

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
        .select('balance, username, avatar_url')
        .eq('bsky_did', did)
        .maybeSingle();

      if (error) {
        console.error('Error fetching balance:', error.message);
      }

      const userBalance = profile?.balance ?? 0;

      // 3. Update component states
      setBalance(userBalance);
      setUserProfile({
        did,
        handle: profile?.username || handle || '',
        avatar: profile?.avatar_url || avatar || '',
      });

      setLoading(false);
    }

    async function fetchGames() {
      setLoading(true);
      const start_of_day = new Date(viewDate);
      start_of_day.setHours(0, 0, 0, 0);

      const end_of_day = new Date(viewDate);
      end_of_day.setHours(23, 59, 59, 999);

      const [gamesRes, liveRes] = await Promise.all([
        supabase
          .from('games')
          .select('*')
          .gte('start_utc', start_of_day.toISOString())
          .lte('start_utc', end_of_day.toISOString())
          .order('updated_at', { ascending: false }),
        supabase.from('live_games').select('*'),
      ]);

      if (gamesRes.error) {
        console.error('Error fetching games:', gamesRes.error.message);
      } else if (gamesRes.data) {
        setGames(gamesRes.data);
      }

      if (liveRes.error) {
        console.error('Error fetching live games:', liveRes.error.message);
        setLiveGames({});
      } else if (liveRes.data) {
        setLiveGames(toLiveMap(liveRes.data as LiveGame[]));
      }

      setLoading(false);
    }

    fetchGames();
    loadUserData();
  }, [viewDate, supabase]);

  // Poll the granular live data while any game is in progress
  useEffect(() => {
    const hasLiveGames = games.some((g) => g.status === 'LIVE');
    if (!hasLiveGames) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      const { data, error } = await supabase.from('live_games').select('*');
      if (cancelled || error || !data) return;
      setLiveGames(toLiveMap(data as LiveGame[]));
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [games, supabase]);

  return (
    <div className="min-h-screen bg-blue-50 text-blue-100 flex flex-col font-sans">
      {/* 1. HEADER */}
      <header className="border-b-4 border-slate-900 bg-blue-400/50 backdrop-blur px-6 py-4 flex justify-between items-center sticky top-0 z-10">
      <div></div>
        <div className="flex items-center gap-3">
          <Image src={banner} alt='BlueLine'></Image>
        </div>

        {!userProfile?.handle && (
          <button 
            onClick={() => setIsLoginOpen(true)}
            className="bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold px-4 py-2 rounded-xl text-sm transition"
          >
            Login with Bluesky
          </button>
        )}
        {userProfile?.handle && (
          <div className="flex items-center gap-4">
            <div className="bg-blue-800/20 border-2 border-slate-900 px-4 py-1.5 rounded-full flex items-center gap-2">
              <span className="text-amber-400 font-bold">⚫</span>
              <span className="font-bold text-amber-200">{balance.toLocaleString()}</span>
              <span className="text-s font-extrabold text-slate-800">PUCKS</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center font-bold text-sm overflow-hidden">
              <img 
                src={userProfile.avatar} 
                alt={userProfile.handle} 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </header>

      {/* 2. BODY LAYOUT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        {/* LEFT NAV SIDEBAR */}
        <nav className="lg:col-span-2 hidden lg:flex flex-col gap-2">
          <button
            onClick={() => setActiveView('games')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-left transition ${
              activeView === 'games'
                ? 'bg-blue-500/10 text-slate-900 border-2 border-slate-900'
                : 'text-slate-900 hover:bg-blue-500/10'
            }`}
          >
            🏒 All Games
          </button>
          <button
            onClick={() => setActiveView('myteams')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-left transition ${
              activeView === 'myteams'
                ? 'bg-blue-500/10 text-slate-900 border-2 border-slate-900'
                : 'text-slate-900 hover:bg-blue-500/10'
            }`}
          >
            👥 My Teams
          </button>
          <button
            onClick={() => setActiveView('idleteam')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-left transition ${
              activeView === 'idleteam'
                ? 'bg-blue-500/10 text-slate-900 border-2 border-slate-900'
                : 'text-slate-900 hover:bg-blue-500/10'
            }`}
          >
            ⏳ Fantasy Idle
          </button>
        </nav>

        {/* MAIN DASHBOARD CONTENT */}
        <main className="lg:col-span-6 flex flex-col gap-6">
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
            />
          )}

          {activeView === 'myteams' && (
            <h2 className="text-base font-bold text-black">"my teams" is not finished yet :-)</h2>
          )}

          {activeView === 'idleteam' && (
            <h2 className="text-base font-bold text-black">"fantasy idle" is not finished yet :-)</h2>
          )}
        </main>

        {/* RIGHT SOCIAL SIDEBAR */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          <LeaderboardPanel></LeaderboardPanel>

          <div className="bg-blue-100 border-2 border-slate-900 rounded-2xl p-5 flex flex-col h-80">
            <h2 className="font-bold text-black text-lg mb-3 flex items-center gap-2">
              🗣️ Shout Box
            </h2>
            
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 text-sm mb-3">
              {chatMessages.map((msg, index) => (
                <div key={index} className="bg-white p-2.5 rounded-xl border border-slate-900">
                  <span className="font-bold text-blue-800 text-s block">{msg.user}</span>
                  <span className="text-slate-500 font-semibold">{msg.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Say something..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-blue-100 border border-black rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-blue-100 placeholder-black"
              />
              <button
                type="submit"
                className="bg-blue-200 hover:bg-blue-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                Send
              </button>
            </form>
          </div>
        </aside>
      </div>

      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
      <BlueskyLoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <Footer onInfoClick={() => setIsInfoOpen(true)} />
    </div>
  );
}