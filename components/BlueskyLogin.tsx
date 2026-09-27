'use client';
import { useState } from 'react';

export default function BlueskyLoginModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/oauth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      });

      const data = await res.json().catch(() => null);

      // The route responds with `url` (older builds used `redirectUrl`).
      const redirectTo: string | undefined = data?.url ?? data?.redirectUrl;

      if (res.ok && redirectTo) {
        // Redirect the user to the Bluesky authorization server.
        window.location.href = redirectTo;
        return;
      }

      setError(data?.error || 'Could not start login. Check the handle and try again.');
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Could not reach the server. Check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
        
        <h2 className="text-xl font-bold mb-1">Sign in with Bluesky</h2>
        <p className="text-xs text-slate-400 mb-4">Enter your handle to log in securely via Bluesky OAuth.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="e.g. user.bsky.social"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 text-slate-100"
            required
          />
          {error && (
            <p role="alert" className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}