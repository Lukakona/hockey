import { NodeOAuthClient, requestLocalLock } from '@atproto/oauth-client-node';
import type { NextRequest, NextResponse } from 'next/server';
import { getClientMetadata, resolveAppUrl } from './oauth-config';
import { createOAuthStores } from './oauth-store';

export {
  CALLBACK_PATH,
  CLIENT_METADATA_PATH,
  OAUTH_SCOPE,
  getClientMetadata,
  resolveAppUrl,
} from './oauth-config';

export interface OAuthClientContext {
  client: NodeOAuthClient;
  /** The public origin the client metadata was built for. */
  appUrl: URL;
  /** Applies any buffered OAuth cookies to the outgoing response. */
  commit(response: NextResponse): void;
}

/**
 * Builds a Bluesky OAuth client for a single incoming request.
 *
 * The client is intentionally not cached on `globalThis`: the AT Protocol
 * handshake is kept in cookies, so each request needs its own store instance
 * bound to that request and response.
 */
export function createOAuthClient(request: NextRequest): OAuthClientContext {
  const appUrl = resolveAppUrl(request);
  const { stateStore, sessionStore, commit } = createOAuthStores(request, appUrl);

  const client = new NodeOAuthClient({
    clientMetadata: getClientMetadata(appUrl),
    plcDirectoryUrl: 'https://plc.directory',
    handleResolver: 'https://bsky.social',
    stateStore,
    sessionStore,
    requestLock: requestLocalLock,
  });

  return { client, appUrl, commit };
}