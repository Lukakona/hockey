'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import BlueskyLoginModal from '@/components/BlueskyLogin';
import Footer from '@/components/Footer';

interface Game {
  id: string;
  nhl_game_id: number;
  home_team: string;
  away_team: string;
  status: string;
  period_info: string;
  score: string;
}

type ActiveView = 'games' | 'myteams' | 'idleteam'

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<{handle: string; avatar: string}>();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('games');
  const [loading, setLoading] = useState<boolean>(true);
  const [balance, setBalance] = useState<number>(1250);
  const [selectedBet, setSelectedBet] = useState<{ label: string; odds: number } | null>(null);
  const [wager, setWager] = useState<string>('50');
  const [chatMessages, setChatMessages] = useState([
    { user: 'the chatter@bsky.social', text: "I'm using tilt controls!" },
    { user: 'ImprisonedBeast@darkness.zone', text: 'aaaaaah let me out of here' },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const supabase = createClient();

  const liveGames = games.filter((g) => g.status === 'LIVE');
  const upcomingGames = games.filter((g) => (g.status === 'FUT' || g.status === 'PRE'));
  const finishedGames = games.filter((g) => g.status === 'FINAL');

  const handlePlaceBet = () => {
    const wagerNum = parseFloat(wager);
    if (!selectedBet || isNaN(wagerNum) || wagerNum <= 0) return;
    if (wagerNum > balance) {
      alert('Insufficient fake balance!');
      return;
    }
    setBalance((prev) => prev - wagerNum);
    alert(`Bet placed! 🪙 ${wagerNum} on ${selectedBet.label} @ ${selectedBet.odds}`);
    setSelectedBet(null);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const sender = userProfile ? `@${userProfile.handle}` : 'You';
    setChatMessages((prev) => [...prev, { user: sender, text: newMessage }]);
    setNewMessage('');
  };

useEffect(() => {
  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    }
    return null;
  };

  // 1. Try reading from URL parameters first (right after OAuth redirect)
  const searchParams = new URLSearchParams(window.location.search);
  const urlHandle = searchParams.get('handle');
  const urlDid = searchParams.get('did');
  const urlAvatar = searchParams.get('avatar');

  // 2. Fallback to cookies
  const handle = urlHandle || getCookie('bsky_handle');
  const did = urlDid || getCookie('bsky_did');
  const avatar = urlAvatar || getCookie('bsky_avatar') || '';

  if (did && handle) {
    // If we got params from the URL, persist them directly to client cookies
    if (urlHandle && urlDid) {
      document.cookie = `bsky_handle=${encodeURIComponent(urlHandle)}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `bsky_did=${encodeURIComponent(urlDid)}; path=/; max-age=604800; SameSite=Lax`;
      if (urlAvatar) {
        document.cookie = `bsky_avatar=${encodeURIComponent(urlAvatar)}; path=/; max-age=604800; SameSite=Lax`;
      }
      // Clean up search params from address bar without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }

    setUserProfile({
      handle,
      avatar,
      did,
    });
  }

  async function fetchGames() {
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching games:', error.message);
    } else if (data) {
      setGames(data);
    }
    setLoading(false);
  }
  console.log(handle)
  console.log(avatar)

  fetchGames();
}, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. HEADER */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500 text-slate-950 font-black p-2 rounded-lg text-xl tracking-wider">
            BLUELINE HOCKEY
          </div>
        </div>

        {userProfile?.handle == null && (
          <>
          <button onClick={() => setIsLoginOpen(true)}>Login with Bluesky</button>
          </>
        )}
        {userProfile?.handle != null && (
          <>
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 border border-slate-700 px-4 py-1.5 rounded-full flex items-center gap-2">
              <span className="text-amber-400 font-bold">⚫</span>
              <span className="font-semibold text-amber-400">{balance.toLocaleString()}</span>
              <span className="text-xs text-slate-400">PUCKS</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center font-bold text-sm">
              <img 
                src={userProfile.avatar}
                alt={userProfile.handle}
                />
            </div>
          </div>
          </>
        )}
      </header>

      {/* 2. BODY LAYOUT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
        
        {/* LEFT NAV SIDEBAR (LG: 2 COL) */}
        <nav className="lg:col-span-2 hidden lg:flex flex-col gap-2">
          <button
            onClick={() => setActiveView('games')}
            className={`flex items-center gap-3 text-slate-400 hover:bg-slate-900 px-4 py-3 rounded-xl font-medium text-left transition ${
            activeView === 'games'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}>
            🏒 All Games
          </button>
          <button
            onClick={() => setActiveView('myteams')}
            className={`flex items-center gap-3 text-slate-400 hover:bg-slate-900 px-4 py-3 rounded-xl font-medium text-left transition ${
            activeView === 'myteams'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}>
            👥 My Teams
          </button>
          <button
            onClick={() => setActiveView('idleteam')}
            className={`flex items-center gap-3 text-slate-400 hover:bg-slate-900 px-4 py-3 rounded-xl font-medium text-left transition ${
            activeView === 'idleteam'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}>
            ⏳ Fantasy Idle
          </button>
        </nav>

        {/* MAIN DASHBOARD CONTENT (LG: 6 COL) */}
        <main className="lg:col-span-6 flex flex-col gap-6">
          {/* GAMES TAB */}
          {activeView === 'games' && (
            <>
            {/* LIVE */}
            {liveGames.length > 0 && (
              <details className="group bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden transition-all">
                <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-slate-900 hover:bg-slate-800/60 transition">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <h2 className="text-base font-bold text-red-400">Live Now</h2>
                    <span className="text-xs text-slate-500 font-mono">({liveGames.length})</span>
                  </div>
                  {/* Accordion Arrow Icon */}
                  <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200">
                    ▼
                  </span>
                </summary>

                <div className="p-4 pt-1 flex flex-col gap-4 border-t border-slate-800/50">
                  {liveGames.map((game) => (
                    <GameCard key={game.id} game={game} onSelectBet={setSelectedBet} />
                  ))}
                </div>
              </details>
            )}

            {/* UPCOMING */}
            {upcomingGames.length > 0 && (
              <details className="group bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden transition-all">
                <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-slate-900 hover:bg-slate-800/60 transition">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-200">Upcoming Games</h2>
                    <span className="text-xs text-slate-500 font-mono">({upcomingGames.length})</span>
                  </div>
                  {/* Accordion Arrow Icon */}
                  <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200">
                    ▼
                  </span>
                </summary>

                <div className="p-4 pt-1 flex flex-col gap-4 border-t border-slate-800/50">
                  {upcomingGames.map((game) => (
                    <GameCard key={game.id} game={game} onSelectBet={setSelectedBet} />
                  ))}
                </div>
              </details>
            )}

            {/* FINISHED */}
            {finishedGames.length > 0 && (
              <details className="group bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden transition-all">
                <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-slate-900 hover:bg-slate-800/60 transition">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-500">Finished Games</h2>
                    <span className="text-xs text-slate-500 font-mono">({finishedGames.length})</span>
                  </div>
                  {/* Accordion Arrow Icon */}
                  <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200">
                    ▼
                  </span>
                </summary>

                <div className="p-4 pt-1 flex flex-col gap-4 border-t border-slate-800/50">
                  {finishedGames.map((game) => (
                    <GameCard key={game.id} game={game} onSelectBet={setSelectedBet} />
                  ))}
                </div>
              </details>
            )}
            </>
        )}

        {activeView === 'myteams' && (
          <>
            <h2 className="text-base font-bold text-gray-200">"my teams" is not finished yet :-)</h2>
          </>
        )}

        {activeView === 'idleteam' && (
          <>
            <h2 className="text-base font-bold text-gray-200">"fantasy idle" is not finished yet :-)</h2>
          </>
        )}

        </main>

        {/* RIGHT SOCIAL SIDEBAR (LG: 4 COL) */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          
          {/* LEADERBOARD PANEL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              🏆 Leaderboard
            </h2>
          </div>

          {/* CHAT PANEL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col h-80">
            <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
              💬 League Chat
            </h2>
            
            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 text-sm mb-3">
              {chatMessages.map((msg, index) => (
                <div key={index} className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-800">
                  <span className="font-bold text-cyan-400 text-xs block">{msg.user}</span>
                  <span className="text-slate-200">{msg.text}</span>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Say something..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 text-slate-100 placeholder-slate-500"
              />
              <button
                type="submit"
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm transition"
              >
                Send
              </button>
            </form>
          </div>
        </aside>
      </div>

      {/* 3. BET SLIP MODAL / DRAWER */}
      {selectedBet && (
        <div className="fixed bottom-4 right-4 max-w-sm w-full bg-slate-900 border border-cyan-500/50 p-5 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-5">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-sm text-cyan-400">Wager Slip</span>
            <button
              onClick={() => setSelectedBet(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>

          <div className="mb-4">
            <div className="text-base font-bold">{selectedBet.label}</div>
            <div className="text-xs text-slate-400">Odds: <span className="text-cyan-400 font-semibold">{selectedBet.odds.toFixed(2)}</span></div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-slate-400">Stake:</label>
            <input
              type="number"
              value={wager}
              onChange={(e) => setWager(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 w-24 text-amber-400 font-bold text-sm focus:outline-none focus:border-cyan-500"
            />
            <span className="text-xs text-slate-400">🪙 PTS</span>
          </div>

          <div className="flex justify-between items-center mb-4 text-xs text-slate-300">
            <span>Est. Payout:</span>
            <span className="font-bold text-amber-400">
              🪙 {((parseFloat(wager) || 0) * selectedBet.odds).toFixed(0)} PTS
            </span>
          </div>

          <button
            onClick={handlePlaceBet}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-2.5 rounded-xl text-sm transition"
          >
            CONFIRM BET
          </button>
        </div>
      )}

      <BlueskyLoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onSuccess={() => setIsLoginOpen(false)}/>
      <Footer/>
    </div>
  );
}

function GameCard({
  game,
  onSelectBet,
}: {
  game: Game;
  onSelectBet: (bet: { label: string; odds: number; gameId: string }) => void;
}) {
  const isLive = game.status === 'LIVE' || game.status === 'CRIT';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
      {/* Indicator Bar */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
      )}

      {/* Status Header */}
      <div className="flex justify-between items-center mb-4 text-xs font-semibold">
        <span
          className={
            isLive
              ? 'text-red-400 animate-pulse flex items-center gap-1.5'
              : 'text-slate-400'
          }
        >
          {isLive && (
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          )}
          {game.period_info || game.status}
        </span>
        <span className="text-slate-500 font-mono">#{game.nhl_game_id}</span>
      </div>

      {/* Teams & Score */}
      <div className="flex justify-between items-center mb-6 px-2">
        <div className="font-bold text-base sm:text-lg">{game.home_team}</div>
        <div className="bg-slate-800 text-cyan-400 px-3 py-1 rounded-lg font-black tracking-widest text-sm">
          {game.score}
        </div>
        <div className="font-bold text-base sm:text-lg text-right">
          {game.away_team}
        </div>
      </div>
    </div>
  );
}