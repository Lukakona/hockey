'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EnrichedGame } from '@/app/page';
import type { PlayRow } from '@/app/api/update-live/route';
import { useTickingClock } from './NHLWeekDay';
import { formatClock } from './NHLWeekDay';

enum PLAY_CODES {
  penalty = '{committedByPlayerId} took a penalty: {descKey} against {drawnByPlayerId}. {typeCode} - {duration} minutes.',
  'blocked-shot' = '{blockingPlayerId} blocked a shot from {shootingPlayerId}',
  faceoff = '{winningPlayerId} won a face-off against {losingPlayerId}',
  stoppage = 'Stoppage in play.',
  'shot-on-goal' = '{shootingPlayerId} made a {shotType}-shot on goal. Saved by {goalieInNetId}',
  hit = '{hittingPlayerId} hit {hitteePlayerId}',
  goal = '{scoringPlayerId} shoots, and scores!! Assised by {assist1PlayerId} and {assist2PlayerId}, against {goalieInNetId}. Score is now {awayScore} - {homeScore}',
  'missed-shot' = '{shootingPlayerId} missed a {shotType}-shot, {reason}.',
  takeaway = '{playerId} forced a turnover!',
  giveaway = '{playerId} gave up the puck!',
  'period-end' = 'End of period.',
}

function playLabel(description: string | null): string {
  if (!description) return '';
  return PLAY_CODES[description as keyof typeof PLAY_CODES] ?? description;
}

const PLAYER_ID_KEYS = new Set([
  'playerId',
  'scoringPlayerId',
  'assist1PlayerId',
  'assist2PlayerId',
  'committedByPlayerId',
  'drawnByPlayerId',
  'blockingPlayerId',
  'shootingPlayerId',
  'winningPlayerId',
  'losingPlayerId',
  'hittingPlayerId',
  'hitteePlayerId',
  'goalieInNetId',
]);

// regex fill the template of play codes. i love doing it this way :)
function buildPlay(play: PlayRow, players: Map<number, string>): string {
  const template = playLabel(play.description);
  const details = play.details;
  if (!details) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = details[key];
    if (value == null) return '';
    if (PLAYER_ID_KEYS.has(key)) {
      const name = players.get(Number(value));
      if (name) return name;
    }
    return String(value);
  });
}

interface PlayerNameRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

export default function FullGameDetails({ game }: { game: EnrichedGame }) {
  const gameDate = new Date(game.start_utc + 'Z');
  const [playByPlay, setPlayByPlay] = useState<PlayRow[]>([]);
  const [players, setPlayers] = useState<Map<number, string>>(new Map());
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const formattedDate = gameDate.toLocaleDateString('en-US', options);
  const supabase = useMemo(() => createClient(), []);
  const tickingSeconds = useTickingClock(
    game.live?.seconds_left,
    game.live?.clock_running || false
  );
  const clockText = game.live?.in_intermission ? 'Intermission' : formatClock(tickingSeconds);

  const fetchPlayByPlay = useCallback(
    async (nhlGameId: number): Promise<Array<PlayRow> | null> => {
      const { data, error } = await supabase
        .from('play_by_play')
        .select('*')
        .eq('nhl_game_id', nhlGameId)
        .order('sort_order', { ascending: false });
      if (error) {
        console.error('Error fetching teams:', error.message);
        return null;
      }
      return data ? (data as PlayRow[]) : null;
    },
    [supabase]
  );

  const fetchPlayers = useCallback(async (): Promise<PlayerNameRow[] | null> => {
    const { data, error } = await supabase.from('players').select('id, first_name, last_name');
    if (error) {
      console.error('Error fetching players:', error.message);
      return null;
    }
    return data as PlayerNameRow[];
  }, [supabase]);

  useEffect(() => {
    async function refresh() {
      const [playData, playerData] = await Promise.all([
        fetchPlayByPlay(game.nhl_game_id),
        fetchPlayers(),
      ]);
      if (playData) setPlayByPlay(playData);
      if (playerData) {
        const map = new Map<number, string>();
        for (const p of playerData) {
          const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
          if (name) map.set(p.id, name);
        }
        setPlayers(map);
      }
    }

    refresh();
  }, [fetchPlayByPlay, fetchPlayers, game.nhl_game_id]);

  return (
    <div className="animate-slide-in-up rounded-2xl border-4 border-black bg-blue-100 p-6 text-center text-black motion-reduce:animate-none">
      {game.status === 'LIVE' && (
        <div className="justify-left flex">
          <span className="mx-2 my-auto h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <div className="animate-pulse font-bold text-red-500">LIVE</div>
        </div>
      )}
      <div className="flex justify-between">
        <div className="flex flex-col rounded-xl p-2">
          <img
            src={game.away_icon}
            alt={game.away_team}
            className="mx-auto flex h-20 w-20 shrink-0 rounded-full border border-black object-cover"
          />
          <div className="truncate p-2 text-center text-base font-bold sm:text-lg">
            {game.away_city} <br />
            {game.away_team} <br />
            {game.awayTeam?.wins} - {game.awayTeam?.losses} - {game.awayTeam?.ties}
          </div>
        </div>
        <div className="my-6 content-end text-4xl font-extrabold">{game.live?.away_score}</div>
        {game.status === 'LIVE' && clockText != 'Intermission' && (
          <div className="w-25 content-center">
            <div className="text-m font-bold text-blue-600">Period {game.live?.period}</div>
            <div className="rounded-xl border-2 bg-blue-600/20 px-4 text-xl font-extrabold">
              {clockText}
            </div>
          </div>
        )}
        {clockText === 'Intermission' && (
          <div className="w-25 content-center">
            <div className="text-m font-bold text-blue-600">End of Period {game.live?.period}</div>
          </div>
        )}
        {game.status === 'FUT' && (
          <div className="content-center">
            <div className="pb-2 font-extrabold text-blue-800">
              {formattedDate} <br />
              {gameDate.toLocaleTimeString()}
            </div>
            <div className="content-center font-extrabold text-black">@ {game.venue}</div>
          </div>
        )}
        {game.status === 'CRIT' && (
          <div className="content-center">
            <div className="pb-2 font-extrabold text-blue-800">
              {formattedDate} <br />
              {gameDate.toLocaleTimeString()}
            </div>
            <div className="content-center font-extrabold text-black">@ {game.venue}</div>
          </div>
        )}
        {(game.status === 'OFF' || game.status === 'FINAL') && (
          <div className="content-center">
            <div className="pb-2 font-extrabold text-slate-700">
              {formattedDate} <br />
              {gameDate.toLocaleTimeString()}
            </div>
            <div className="pb-2 text-3xl font-extrabold text-blue-800">FINAL</div>
          </div>
        )}
        <div className="my-6 content-end text-4xl font-extrabold">{game.live?.home_score}</div>
        <div className="flex flex-col rounded-xl p-2">
          <img
            src={game.home_icon}
            alt={game.home_team}
            className="mx-auto flex h-20 w-20 shrink-0 rounded-full border border-black object-cover"
          />
          <div className="text-ceter truncate p-2 text-base font-bold sm:text-lg">
            {game.home_city} <br />
            {game.home_team} <br />
            {game.homeTeam?.wins} - {game.homeTeam?.losses} - {game.homeTeam?.ties}
          </div>
        </div>
      </div>
      {(game.status === 'LIVE' ||
        game.status === 'OFF' ||
        game.status === 'CRIT' ||
        game.status === 'FINAL') && (
        <div>
          <div className="flex justify-center border-2 border-black bg-blue-800/40">
            <div className="font-bold">Shots on Goal</div>
          </div>
          <div className="flex justify-center border-r-2 border-b-2 border-l-2 border-black bg-blue-300/80">
            <div className="mx-auto flex flex-col">
              <div className="font-bold">{game.live?.away_sog}</div>
            </div>
            <div className="border" />
            <div className="mx-auto flex flex-col">
              <div className="font-bold">{game.live?.home_sog}</div>
            </div>
          </div>
          <div className="mt-2 flex justify-center border-2 border-black bg-blue-800/40">
            <div className="font-bold">Play-by-Play</div>
          </div>
          <div className="scrollbar-hide h-120 overflow-y-auto border-b-2">
            {playByPlay.map((play) => {
              const isHome = play.team_id != null && play.team_id === game.live?.home_id;
              const isAway = play.team_id != null && play.team_id === game.live?.away_id;
              const teamName = isHome
                ? game.homeTeam?.team_name
                : isAway
                  ? game.awayTeam?.team_name
                  : null;
              const teamIcon = isHome ? game.home_icon : isAway ? game.away_icon : null;

              return (
                <div
                  key={play.sort_order}
                  className="flex items-center gap-3 border-r-2 border-b-2 border-l-2 border-black bg-blue-300/80 px-3 py-2 text-left"
                >
                  {teamIcon && (
                    <img
                      src={teamIcon}
                      alt={teamName ?? ''}
                      className="h-15 w-15 shrink-0 object-contain"
                    />
                  )}
                  <div className="w-24 shrink-0 truncate text-sm font-extrabold">
                    {teamName ?? ''}
                  </div>
                  <div className="min-w-0 flex-1 text-sm break-words">
                    {buildPlay(play, players)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
