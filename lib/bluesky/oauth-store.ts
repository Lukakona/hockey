import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from '@atproto/oauth-client-node';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Cookie-backed implementations of the AT Protocol OAuth state & session stores.
 *
 * Why not the previous `Map` on `globalThis`?
 * The authorization `state` (which holds the PKCE verifier and the DPoP key) is
 * written by `/api/oauth/login` and read back by `/api/oauth/callback`. On any
 * host with more than one server instance (serverless, containers behind a load
 * balancer) those two requests can land on different processes, so an in-memory
 * map produces `Unknown authorization session "<state>"`. Storing the handshake
 * in a cookie keeps it with the user's browser, so the flow works regardless of
 * how many instances are running.
 */

const STATE_COOKIE = 'bsky_oauth_state';
const SESSION_COOKIE = 'bsky_oauth_session';
const COOKIE_PATH = '/';

const STATE_MAX_AGE_SECONDS = 60 * 60; // 1 hour is plenty for a login round-trip.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days.

/** Keep only the most recent handshakes so a few parallel logins still work. */
const MAX_STATE_ENTRIES = 5;
const MAX_SESSION_ENTRIES = 5;

/** Browsers reject cookies larger than ~4KB; stay comfortably below that. */
const MAX_COOKIE_BYTES = 3800;

const encoder = new TextEncoder();

export interface OAuthStoreBundle {
  stateStore: NodeSavedStateStore;
  sessionStore: NodeSavedSessionStore;
  /** Applies buffered cookie writes to the outgoing response. */
  commit(response: NextResponse): void;
}

type CookieRecord<T> = Record<string, T>;

function decodeRecord<T>(raw: string | undefined): CookieRecord<T> {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CookieRecord<T>;
    }
  } catch {
    // Corrupt/legacy cookie: start clean rather than breaking the login flow.
  }

  return {};
}

/** Serializes a record, trimming the oldest entries until it fits in a cookie. */
function encodeRecord<T>(record: CookieRecord<T>, maxEntries: number): string | null {
  let entries = Object.entries(record);
  if (entries.length > maxEntries) entries = entries.slice(-maxEntries);

  while (entries.length > 0) {
    const encoded = JSON.stringify(Object.fromEntries(entries));
    if (encoder.encode(encoded).length <= MAX_COOKIE_BYTES) return encoded;
    entries = entries.slice(1);
  }

  return null;
}

export function createOAuthStores(request: NextRequest, appUrl: URL): OAuthStoreBundle {
  const isSecure = appUrl.protocol === 'https:';

  const stateRecord = decodeRecord<NodeSavedState>(request.cookies.get(STATE_COOKIE)?.value);
  const sessionRecord = decodeRecord<NodeSavedSession>(
    request.cookies.get(SESSION_COOKIE)?.value
  );

  /** Buffered writes, flushed by `commit` so we never depend on header timing. */
  const pendingCookies = new Map<string, { value: string; maxAge: number }>();

  const writeRecord = <T>(name: string, record: CookieRecord<T>, maxAge: number, maxEntries: number) => {
    const encoded = encodeRecord(record, maxEntries);

    if (encoded === null) {
      console.warn(
        `[bluesky-oauth] "${name}" exceeded the cookie size limit and was not persisted. ` +
          `The login itself is unaffected, but the AT Protocol session cannot be restored later.`
      );
      pendingCookies.set(name, { value: '', maxAge: 0 });
      return;
    }

    pendingCookies.set(name, { value: encoded, maxAge });
  };

  const stateStore: NodeSavedStateStore = {
    async get(key: string) {
      return stateRecord[key];
    },
    async set(key: string, value: NodeSavedState) {
      stateRecord[key] = value;
      writeRecord(STATE_COOKIE, stateRecord, STATE_MAX_AGE_SECONDS, MAX_STATE_ENTRIES);
    },
    async del(key: string) {
      delete stateRecord[key];
      writeRecord(STATE_COOKIE, stateRecord, STATE_MAX_AGE_SECONDS, MAX_STATE_ENTRIES);
    },
  };

  const sessionStore: NodeSavedSessionStore = {
    async get(key: string) {
      return sessionRecord[key];
    },
    async set(key: string, value: NodeSavedSession) {
      sessionRecord[key] = value;
      writeRecord(SESSION_COOKIE, sessionRecord, SESSION_MAX_AGE_SECONDS, MAX_SESSION_ENTRIES);
    },
    async del(key: string) {
      delete sessionRecord[key];
      writeRecord(SESSION_COOKIE, sessionRecord, SESSION_MAX_AGE_SECONDS, MAX_SESSION_ENTRIES);
    },
  };

  const commit = (response: NextResponse) => {
    for (const [name, { value, maxAge }] of pendingCookies) {
      response.cookies.set(name, value, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        path: COOKIE_PATH,
        maxAge,
      });
    }
    pendingCookies.clear();
  };

  return { stateStore, sessionStore, commit };
}
