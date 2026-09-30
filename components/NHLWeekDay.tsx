'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EnrichedGame, Game } from '@/app/page';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  balance: number;
}

export default function NHLWeekDay( {
  games,
  date,
  balance,
  placeBet,
  changeDate
}: {
  games: EnrichedGame[];
  date: Date;
  balance: number
  placeBet: (wager: number) => void;
  changeDate: (days: number) => void;
  }) {

    const [loading, setLoading] = useState<boolean>(false);
    const [selectedBet, setSelectedBet] = useState<{ label: string; odds: number } | null>(null);
    const liveGames = games.filter((g) => g.status === 'LIVE');
    const upcomingGames = games.filter((g) => (g.status === 'FUT' || g.status === 'PRE'));
    const finishedGames = games.filter((g) => g.status === 'FINAL');
    const [wager, setWager] = useState<string>('50');

    if (loading) {
        return (
            <div className="bg-blue-100 border border-black rounded-2xl p-6 text-center text-amber-800 animate-pulse">
                Loading games...
            </div>
        );
    }

    return (
        <div>
            <div className="bg-blue-100 border-4 border-black rounded-2xl p-6 text-center text-black">
                <div className='flex items-center justify-between mb-4'>
                    <button className="text-black hover:bg-blue-200 p-6 mr-2 rounded-xl font-medium text-left transition"
                        onClick={() => changeDate(-1)}>
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                    >
                        <path d="m15 18-6-6 6-6"/>
                    </svg>
                    </button>
                    <div className="bg-blue-400 border-black border-2 rounded-2xl p-2 w-100 text-black font-semibold">
                        {date.toDateString().slice(0,3)}
                        <br/>
                        {date.toDateString().slice(3)}
                    </div>
                    <button className="text-black hover:bg-blue-200 p-6 mr-2 rounded-xl font-medium text-left transition"
                        onClick={() => changeDate(1)}>
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                    >
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                    </button>
                </div>
            
                {/* LIVE */}
                {liveGames.length > 0 && (
                    <details open className="group bg-blue-200 border-2 border-black rounded-2xl overflow-hidden transition-all">
                    <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-blue-300 hover:bg-blue-400 transition">
                        <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <h2 className="text-base font-bold text-red-600">Live Now</h2>
                        <span className="text-s font-bold text-blue-900 font-mono">({liveGames.length})</span>
                        </div>
                        {/* Accordion Arrow Icon */}
                        <span className="text-black group-open:rotate-180 transition-transform duration-200">
                        ▼
                        </span>
                    </summary>

                    <div className="p-4 pt-1 flex flex-col gap-4 border-t border-black">
                        {liveGames.map((game) => (
                        <LiveGameCard key={game.nhl_game_id} game={game} onSelectBet={setSelectedBet} />
                        ))}
                    </div>
                    </details>
                )}

                {/* UPCOMING */}
                {upcomingGames.length > 0 && (
                    <details open className="group bg-blue-200 border-2 border-black rounded-2xl overflow-hidden transition-all">
                    <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-blue-300 hover:bg-blue-400 transition">
                        <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-black">Upcoming Games</h2>
                        <span className="text-s font-bold text-blue-900 font-mono">({upcomingGames.length})</span>
                        </div>
                        {/* Accordion Arrow Icon */}
                        <span className="text-black group-open:rotate-180 transition-transform duration-200">
                        ▼
                        </span>
                    </summary>

                    <div className="p-4 pt-1 flex flex-col gap-4 border-t border-black">
                        {upcomingGames.map((game) => (
                        <GameCard key={game.nhl_game_id} game={game} onSelectBet={setSelectedBet} />
                        ))}
                    </div>
                    </details>
                )}

                {/* FINISHED */}
                {finishedGames.length > 0 && (
                    <details open className="group bg-blue-200 border-2 border-black rounded-2xl overflow-hidden transition-all">
                    <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-blue-300 hover:bg-blue-400 transition">
                        <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-gray-600">Finished Games</h2>
                        <span className="text-s font-bold text-blue-900 font-mono">({finishedGames.length})</span>
                        </div>
                        {/* Accordion Arrow Icon */}
                        <span className="text-black group-open:rotate-180 transition-transform duration-200">
                        ▼
                        </span>
                    </summary>

                    <div className="p-4 pt-1 flex flex-col gap-4 border-t border-black">
                        {finishedGames.map((game) => (
                        <GameCard key={game.nhl_game_id} game={game} onSelectBet={setSelectedBet} />
                        ))}
                    </div>
                    </details>
                )}

                {/* NO GAMES WARNY */}
                {finishedGames.length === 0 && upcomingGames.length === 0 && liveGames.length === 0 && (
                    <div>
                        No games scheduled.
                    </div>
                )} 
            </div>
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
  const hasScore = game.score != null;
  const date = new Date(game.start_utc + 'Z');

  return (
    <div className="bg-blue-100 border-2 border-black rounded-2xl p-5 shadow-lg relative overflow-hidden">
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
              : 'text-blue-800'
          }
        >
          {isLive && (
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          )}
          {game.status === 'PRE' && (
            <p>Starting soon...</p>
          )}
          {game.status === 'LIVE' && (
            game.period_info
          )}
          {game.status === 'FUT' && (
            date.toLocaleTimeString()
          )}
        </span>
        <span className="text-slate-600 font-mono">{game.venue}</span>
      </div>

        {/* Teams & Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-6 px-2">
        {/* Away Team Column */}
        <div className="flex items-center gap-2 min-w-0">
            <img
            src={game.away_icon}
            alt={game.away_team}
            className="w-9 h-9 rounded-full object-cover border border-black shrink-0"
            />
            <div className="font-bold text-base sm:text-lg truncate">
            {game.away_team}
            </div>
        </div>

        {/* Center Score Column */}
        <div className="flex flex-col items-center justify-center text-center">
            <div className='font-extrabold'>@</div>
            {hasScore && (
            <div className="bg-blue-800 text-cyan-400 px-3 py-1 rounded-lg font-black tracking-widest text-sm whitespace-nowrap">
                {game.score}
            </div>
            )}
        </div>

        {/* Home Team Column */}
        <div className="flex items-center justify-end gap-2 min-w-0">
            <div className="font-bold text-base sm:text-lg text-right truncate">
            {game.home_team}
            </div>
            <img
            src={game.home_icon}
            alt={game.home_team}
            className="w-9 h-9 rounded-full object-cover border border-black shrink-0"
            />
        </div>
        </div>
    </div>
  );
}

function LiveGameCard({
  game,
  onSelectBet,
}: {
  game: EnrichedGame;
  onSelectBet: (bet: { label: string; odds: number; gameId: string }) => void;
}) {
  const live = game.live;
  const isIntermission = !!live?.in_intermission;
  const tickingSeconds = useTickingClock(live?.seconds_left, !isIntermission);
  const hasLiveScore = live?.away_score != null && live?.home_score != null;
  const scoreText = hasLiveScore
    ? `${live!.away_score} - ${live!.home_score}`
    : game.score;
  const clockText = isIntermission ? 'Intermission' : formatClock(tickingSeconds);

  return (
    <div className="bg-blue-100 border-2 border-black rounded-2xl p-5 shadow-lg relative overflow-hidden">
    <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />

      {/* Status Header */}
      <div className="flex justify-between items-center mb-4 text-xs font-semibold">
        <span className="text-red-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
          {isIntermission && (
            <span className="ml-1 text-blue-950 border border-black rounded-md px-1.5 py-0.5 tracking-wide">
              Intermission
            </span>
          )}
          {isIntermission || 'LIVE'}
        </span>
        <span className="text-slate-600 font-mono">{game.venue}</span>
      </div>

        {/* Teams & Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-2">
        {/* Away Team Column */}
        <div className="flex items-center gap-2 min-w-0">
            <img
            src={game.away_icon}
            alt={game.away_team}
            className="w-9 h-9 rounded-full object-cover border border-black shrink-0"
            />
            <div className="font-bold text-base sm:text-lg truncate">
            {game.away_team}
            </div>
        </div>

        {/* Center Score Column */}
        <div className="flex flex-col items-center justify-center text-center gap-1">
            <div className="border-2 text-black px-3 py-1 rounded-lg font-black tracking-widest text-sm whitespace-nowrap">
                {scoreText}
            </div>
            <div className="text-[11px] font-mono font-bold text-blue-900 whitespace-nowrap">
                {live?.period ? `P${live.period}` : '—'}
                {clockText ? ` · ${clockText}` : ''}
            </div>
        </div>

        {/* Home Team Column */}
        <div className="flex items-center justify-end gap-2 min-w-0">
            <div className="font-bold text-base sm:text-lg text-right truncate">
            {game.home_team}
            </div>
            <img
            src={game.home_icon}
            alt={game.home_team}
            className="w-9 h-9 rounded-full object-cover border border-black shrink-0"
            />
        </div>
        </div>
    </div>
  );
}

// Turns remaining seconds (from live_games) into M:SS
function formatClock(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function useTickingClock(
  seconds: number | null | undefined,
  running: boolean
): number | null {
  const [display, setDisplay] = useState<number | null>(seconds ?? null);
  const anchor = useRef<{ seconds: number; at: number } | null>(null);

  // Re-anchor whenever a fresh authoritative value arrives
  useEffect(() => {
    anchor.current = seconds == null ? null : { seconds, at: Date.now() };
  }, [seconds]);

  // Tick once per second while the clock is running
  useEffect(() => {
    if (!running) return;

    const update = () => {
      const a = anchor.current;
      setDisplay(
        a ? Math.max(0, a.seconds - Math.floor((Date.now() - a.at) / 1000)) : null
      );
    };

    // Refresh immediately after a re-anchor, then once per second
    const warmup = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => {
      clearTimeout(warmup);
      clearInterval(id);
    };
  }, [running, seconds]);

  return display;
}