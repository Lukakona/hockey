'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  balance: number;
}

export default function LeaderboardPanel() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, balance')
        .order('balance', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Leaderboard fetch error:', error.message);
      } else if (data) {
        setProfiles(data);
      }
      setLoading(false);
    }

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="bg-blue-100 border-2 border-black rounded-2xl p-6 text-center text-black animate-pulse">
        Loading community leaderboard...
      </div>
    );
  }

  return (
    <div className="bg-blue-100 border-2 border-black rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black">🏆 Leaderboard</h1>
        </div>
        <span className="text-xs bg-blue-200 text-blue-900 border border-black px-3 py-1 rounded-full font-mono">
          {profiles.length} Active Users!
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {profiles.map((profile, index) => {
          const rank = index + 1;
          const isTopThree = rank <= 3;

          return (
            <div
              key={profile.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                rank === 1
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : rank === 2
                  ? 'bg-blue-300/10 border-blue-400/30'
                  : rank === 3
                  ? 'bg-amber-700/10 border-amber-700/30'
                  : 'bg-blue-800/40 border-blue-800'
              }`}
            >
              {/* Rank & User Info */}
              <div className="flex items-center gap-3.5">
                <span
                  className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs ${
                    rank === 1
                      ? 'bg-amber-500 text-blue-950'
                      : rank === 2
                      ? 'bg-blue-300 text-blue-950'
                      : rank === 3
                      ? 'bg-amber-700 text-white'
                      : 'bg-blue-800 text-blue-400'
                  }`}
                >
                  {rank}
                </span>

                {/* Avatar */}
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="w-9 h-9 rounded-full object-cover border border-black"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-800 border border-blue-700 flex items-center justify-center text-xs font-bold text-cyan-400">
                    {profile.username.substring(0, 2).toUpperCase()}
                  </div>
                )}

                {/* Handles */}
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-black">
                    {profile.display_name || profile.username}
                  </span>
                  <span className="text-xs text-slate-600">@{profile.username}</span>
                </div>
              </div>

              {/* Balance */}
              <div className="text-right">
                <div className="font-mono font-bold text-blue-800 text-sm">
                  ⚫ {Number(profile.balance).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}