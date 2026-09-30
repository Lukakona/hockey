'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Shout {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string | null;
}

const POLL_INTERVAL_MS = 10_000;
const MAX_SHOUTS = 50;

export default function Shoutbox({
  userProfile,
}: {
  userProfile: { id: string; handle: string; avatar: string; did: string } | null;
}) {
  const [loading, setLoading] = useState<boolean>(true);
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the latest shouts, then poll so other people's land too.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function fetchShouts() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_SHOUTS);

      if (cancelled) return;

      if (error) {
        console.error('Error fetching shouts:', error.message);
        setError('Could not load the shout box.');
      } else if (data) {
        setShouts([...data] as Shout[]);
      }

      setLoading(false);
    }

    fetchShouts();
    const interval = setInterval(fetchShouts, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const content = newMessage.trim();
    if (!content || !userProfile?.id || sending) return;

    setSending(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userProfile.id,
        username: userProfile.handle,
        content,
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending shout:', error.message);
      setError('Could not send your message.');
      setSending(false);
      return;
    }

    shouts.unshift(data as Shout);
    setNewMessage('');
    setSending(false);
  };

  return (
    <div className="flex h-120 flex-col rounded-2xl border-2 border-slate-900 bg-blue-100 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-black">🗣️ Shout Box</h2>

      <div className="scrollbar-hide mb-3 flex flex-1 flex-col gap-2.5 overflow-y-auto border-b border-black pr-1 text-sm">
        {loading && <p className="text-center text-slate-500">Loading shouts...</p>}

        {!loading && shouts.length === 0 && (
          <p className="text-center text-slate-500">No shouts yet — be the first!</p>
        )}

        {shouts.map((msg) => (
          <div key={msg.id} className="rounded-xl border border-slate-900 bg-white p-2.5">
            <span className="text-s block font-bold text-blue-800">{msg.username}</span>
            <span className="font-semibold break-words text-slate-500">{msg.content}</span>
          </div>
        ))}
      </div>

      {error && <p className="mb-2 text-center text-xs text-red-600">{error}</p>}

      {userProfile?.id ? (
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            placeholder="Say something..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 rounded-xl border border-black bg-white px-3 py-2 text-sm text-black placeholder-black focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="rounded-xl bg-blue-200 px-4 py-2 text-sm font-bold text-black transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      ) : (
        <p className="text-center text-xs text-slate-600">Log in to join the shout box.</p>
      )}
    </div>
  );
}
