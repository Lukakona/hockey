'use client';

import React, { useEffect, useRef, useState, ViewTransitionPseudoElement } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EnrichedGame, Game } from '@/app/page';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  balance: number;
}

export default function NHLWeekDay({
  games,
  date,
  balance,
  placeBet,
  changeDate,
  selectGame,
}: {
  games: EnrichedGame[];
  date: Date;
  balance: number;
  placeBet: (wager: number) => void;
  changeDate: (days: number) => void;
  selectGame: (gameId: number) => void;
}) {
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedBet, setSelectedBet] = useState<{ label: string; odds: number } | null>(null);
  const liveGames = games.filter((g) => g.status === 'LIVE' || g.status === 'CRIT');
  const upcomingGames = games.filter((g) => g.status === 'FUT' || g.status === 'PRE');
  const finishedGames = games.filter((g) => g.status === 'FINAL' || g.status === 'OFF');
  const [wager, setWager] = useState<string>('50');

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-black bg-blue-100 p-6 text-center text-amber-800">
        Loading games...
      </div>
    );
  }

  return (
    <div className="animate-slide-in-up motion-reduce:animate-none">
      <div className="rounded-2xl border-4 border-black bg-blue-100 p-6 text-center text-black">
        <div className="mb-4 flex items-center justify-between">
          <button
            className="mr-2 rounded-xl p-6 text-left font-medium text-black transition hover:bg-blue-200"
            onClick={() => changeDate(-1)}
          >
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="w-100 rounded-2xl border-2 border-black bg-blue-400 p-2 font-semibold text-black">
            {date.toDateString().slice(0, 3)}
            <br />
            {date.toDateString().slice(3)}
          </div>
          <button
            className="mr-2 rounded-xl p-6 text-left font-medium text-black transition hover:bg-blue-200"
            onClick={() => changeDate(1)}
          >
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
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* LIVE */}
        {liveGames.length > 0 && (
          <details
            open
            className="group overflow-hidden rounded-2xl border-2 border-black bg-blue-200 transition-all"
          >
            <summary className="flex cursor-pointer items-center justify-between bg-blue-300 p-4 transition select-none hover:bg-blue-400">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <h2 className="text-base font-bold text-red-600">Live Now</h2>
                <span className="text-s font-mono font-bold text-blue-900">
                  ({liveGames.length})
                </span>
              </div>
              {/* Accordion Arrow Icon */}
              <span className="text-black transition-transform duration-200 group-open:rotate-180">
                ▼
              </span>
            </summary>

            <div className="flex flex-col gap-4 border-t border-black p-4 pt-1">
              {liveGames.map((game) => (
                <LiveGameCard
                  key={game.nhl_game_id}
                  game={game}
                  onSelectBet={setSelectedBet}
                  onSelectGame={selectGame}
                />
              ))}
            </div>
          </details>
        )}

        {/* UPCOMING */}
        {upcomingGames.length > 0 && (
          <details
            open
            className="group overflow-hidden rounded-2xl border-2 border-black bg-blue-200 transition-all"
          >
            <summary className="flex cursor-pointer items-center justify-between bg-blue-300 p-4 transition select-none hover:bg-blue-400">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-black">Upcoming Games</h2>
                <span className="text-s font-mono font-bold text-blue-900">
                  ({upcomingGames.length})
                </span>
              </div>
              {/* Accordion Arrow Icon */}
              <span className="text-black transition-transform duration-200 group-open:rotate-180">
                ▼
              </span>
            </summary>

            <div className="flex flex-col gap-4 border-t border-black p-4 pt-1">
              {upcomingGames.map((game) => (
                <GameCard
                  key={game.nhl_game_id}
                  game={game}
                  onSelectBet={setSelectedBet}
                  onSelectGame={(gameId: number) => selectGame(gameId)}
                />
              ))}
            </div>
          </details>
        )}

        {/* FINISHED */}
        {finishedGames.length > 0 && (
          <details
            open
            className="group overflow-hidden rounded-2xl border-2 border-black bg-blue-200 transition-all"
          >
            <summary className="flex cursor-pointer items-center justify-between bg-blue-300 p-4 transition select-none hover:bg-blue-400">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-600">Finished Games</h2>
                <span className="text-s font-mono font-bold text-blue-900">
                  ({finishedGames.length})
                </span>
              </div>
              {/* Accordion Arrow Icon */}
              <span className="text-black transition-transform duration-200 group-open:rotate-180">
                ▼
              </span>
            </summary>

            <div className="flex flex-col gap-4 border-t border-black p-4 pt-1">
              {finishedGames.map((game) => (
                <GameCard
                  key={game.nhl_game_id}
                  game={game}
                  onSelectBet={setSelectedBet}
                  onSelectGame={(gameId: number) => selectGame(gameId)}
                />
              ))}
            </div>
          </details>
        )}

        {/* NO GAMES WARNY */}
        {finishedGames.length === 0 && upcomingGames.length === 0 && liveGames.length === 0 && (
          <div>No games scheduled.</div>
        )}
      </div>
    </div>
  );
}

function GameCard({
  game,
  onSelectBet,
  onSelectGame,
}: {
  game: Game;
  onSelectBet: (bet: { label: string; odds: number; gameId: string }) => void;
  onSelectGame: (gameId: number) => void;
}) {
  const isLive = game.status === 'LIVE' || game.status === 'CRIT';
  const hasScore = game.score != null;
  const date = new Date(game.start_utc + 'Z');

  return (
    <button
      onClick={() => onSelectGame(game.nhl_game_id)}
      className="relative overflow-hidden rounded-2xl border-2 border-black bg-blue-100 p-5 shadow-lg"
    >
      {/* Indicator Bar */}
      {isLive && <div className="absolute top-0 right-0 left-0 h-1 animate-pulse bg-red-500" />}

      {/* Status Header */}
      <div className="mb-4 flex items-center justify-between text-xs font-semibold">
        <span
          className={
            isLive ? 'flex animate-pulse items-center gap-1.5 text-red-400' : 'text-blue-800'
          }
        >
          {isLive && <span className="inline-block h-2 w-2 rounded-full bg-red-500" />}
          {game.status === 'PRE' && <p>Starting soon...</p>}
          {game.status === 'LIVE' && game.period_info}
          {game.status === 'FUT' && date.toLocaleTimeString()}
        </span>
        <span className="font-mono text-slate-600">{game.venue}</span>
      </div>

      {/* Teams & Score */}
      <div className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-2">
        {/* Away Team Column */}
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={game.away_icon}
            alt={game.away_team}
            className="h-9 w-9 shrink-0 rounded-full border border-black object-cover"
          />
          <div className="truncate text-base font-bold sm:text-lg">{game.away_team}</div>
        </div>

        {/* Center Score Column */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="font-extrabold">@</div>
          {hasScore && (
            <div className="rounded-lg bg-blue-800 px-3 py-1 text-sm font-black tracking-widest whitespace-nowrap text-cyan-400">
              {game.score}
            </div>
          )}
        </div>

        {/* Home Team Column */}
        <div className="flex min-w-0 items-center justify-end gap-2">
          <div className="truncate text-right text-base font-bold sm:text-lg">{game.home_team}</div>
          <img
            src={game.home_icon}
            alt={game.home_team}
            className="h-9 w-9 shrink-0 rounded-full border border-black object-cover"
          />
        </div>
      </div>
    </button>
  );
}

function LiveGameCard({
  game,
  onSelectBet,
  onSelectGame,
}: {
  game: EnrichedGame;
  onSelectBet: (bet: { label: string; odds: number; gameId: string }) => void;
  onSelectGame: (gameId: number) => void;
}) {
  const live = game.live;
  const isIntermission = !!live?.in_intermission;
  const tickingSeconds = useTickingClock(live?.seconds_left, !isIntermission);
  const hasLiveScore = live?.away_score != null && live?.home_score != null;
  const scoreText = hasLiveScore ? `${live!.away_score} - ${live!.home_score}` : game.score;
  const clockText = isIntermission ? 'Intermission' : formatClock(tickingSeconds);

  return (
    <button
      onClick={() => onSelectGame(game.nhl_game_id)}
      className="relative overflow-hidden rounded-2xl border-2 border-black bg-blue-100 p-5 shadow-lg"
    >
      <div className="absolute top-0 right-0 left-0 h-1 animate-pulse bg-red-500" />

      {/* Status Header */}
      <div className="mb-4 flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-red-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          {isIntermission && (
            <span className="ml-1 rounded-md border border-black px-1.5 py-0.5 tracking-wide text-blue-950">
              Intermission
            </span>
          )}
          {isIntermission || 'LIVE' || 'CRIT'}
        </span>
        <span className="font-mono text-slate-600">{game.venue}</span>
      </div>

      {/* Teams & Score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-2">
        {/* Away Team Column */}
        <div className="flex min-w-0 items-center gap-2">
          <img
            src={game.away_icon}
            alt={game.away_team}
            className="h-9 w-9 shrink-0 rounded-full border border-black object-cover"
          />
          <div className="truncate text-base font-bold sm:text-lg">{game.away_team}</div>
        </div>

        {/* Center Score Column */}
        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <div className="rounded-lg border-2 px-3 py-1 text-sm font-black tracking-widest whitespace-nowrap text-black">
            {scoreText}
          </div>
          <div className="font-mono text-[11px] font-bold whitespace-nowrap text-blue-900">
            {live?.period ? `P${live.period}` : '—'}
            {clockText ? ` · ${clockText}` : ''}
          </div>
        </div>

        {/* Home Team Column */}
        <div className="flex min-w-0 items-center justify-end gap-2">
          <div className="truncate text-right text-base font-bold sm:text-lg">{game.home_team}</div>
          <img
            src={game.home_icon}
            alt={game.home_team}
            className="h-9 w-9 shrink-0 rounded-full border border-black object-cover"
          />
        </div>
      </div>
    </button>
  );
}

// Turns remaining seconds (from live_games) into M:SS
export function formatClock(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function useTickingClock(
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
      setDisplay(a ? Math.max(0, a.seconds - Math.floor((Date.now() - a.at) / 1000)) : null);
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
