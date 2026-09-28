'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Game } from '@/app/page';
import { Timestamp } from 'next/dist/server/lib/cache-handlers/types';

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
  games: Game[];
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400 animate-pulse">
                Loading games...
            </div>
        );
    }

    return (
        <div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
                <div className='flex items-center justify-between mb-4'>
                    <button className="text-slate-400 hover:bg-slate-800 p-6 mr-2 rounded-xl font-medium text-left transition"
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
                    <div className="bg-slate-800 border-slate-100 rounded-2xl p-2 w-100 text-slate-300">
                        {date.toDateString().slice(0,3)}
                        <br/>
                        {date.toDateString().slice(3)}
                    </div>
                    <button className="text-slate-400 hover:bg-slate-800 p-6 ml-2 rounded-xl font-medium text-left transition"
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
  console.log(date);

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
          {game.period_info || date.toLocaleTimeString()}
        </span>
        <span className="text-slate-500 font-mono">{game.venue}</span>
      </div>

        {/* Teams & Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-6 px-2">
        {/* Away Team Column */}
        <div className="flex items-center gap-2 min-w-0">
            <img
            src={game.away_icon}
            alt={game.away_team}
            className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
            />
            <div className="font-bold text-base sm:text-lg truncate">
            {game.away_team}
            </div>
        </div>

        {/* Center Score Column */}
        <div className="flex flex-col items-center justify-center text-center">
            <div>@</div>
            {hasScore && (
            <div className="bg-slate-800 text-cyan-400 px-3 py-1 rounded-lg font-black tracking-widest text-sm whitespace-nowrap">
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
            className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
            />
        </div>
        </div>
    </div>
  );
}