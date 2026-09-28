import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from '@atproto/oauth-client-node';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { NextRequest, NextResponse } from 'next/server';

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function createOAuthStores(request: NextRequest, appUrl: URL) {
  const stateStore: NodeSavedStateStore = {
    async get(key: string): Promise<NodeSavedState | undefined> {
      const supabase = getAdminClient();
      const { data } = await supabase
        .from('oauth_states')
        .select('state')
        .eq('key', key)
        .maybeSingle();

      return data ? (JSON.parse(data.state) as NodeSavedState) : undefined;
    },

    async set(key: string, val: NodeSavedState): Promise<void> {
      const supabase = getAdminClient();
      await supabase.from('oauth_states').upsert({
        key,
        state: JSON.stringify(val),
        updated_at: new Date().toISOString(),
      });
    },

    async del(key: string): Promise<void> {
      const supabase = getAdminClient();
      await supabase.from('oauth_states').delete().eq('key', key);
    },
  };

  const sessionStore: NodeSavedSessionStore = {
    async get(key: string): Promise<NodeSavedSession | undefined> {
      const supabase = getAdminClient();
      const { data } = await supabase
        .from('oauth_sessions')
        .select('session')
        .eq('key', key)
        .maybeSingle();

      return data ? (JSON.parse(data.session) as NodeSavedSession) : undefined;
    },

    async set(key: string, val: NodeSavedSession): Promise<void> {
      const supabase = getAdminClient();
      await supabase.from('oauth_sessions').upsert({
        key,
        session: JSON.stringify(val),
        updated_at: new Date().toISOString(),
      });
    },

    async del(key: string): Promise<void> {
      const supabase = getAdminClient();
      await supabase.from('oauth_sessions').delete().eq('key', key);
    },
  };

  const commit = (response: NextResponse) => {};

  return { stateStore, sessionStore, commit };
}