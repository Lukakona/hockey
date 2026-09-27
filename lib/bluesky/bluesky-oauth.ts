import {
  NodeOAuthClient,
  buildAtprotoLoopbackClientMetadata,
  NodeSavedState,
  NodeSavedSession,
} from '@atproto/oauth-client-node';

const globalAuth = globalThis as unknown as {
  stateStore?: Map<string, NodeSavedState>;
  sessionStore?: Map<string, NodeSavedSession>;
  oauthClient?: NodeOAuthClient;
};

globalAuth.stateStore ??= new Map();
globalAuth.sessionStore ??= new Map();

// Define extended scope including generic AppView RPC permissions
const OAUTH_SCOPE = 'atproto transition:generic';

export function getOAuthClient(): NodeOAuthClient {
  if (globalAuth.oauthClient) return globalAuth.oauthClient;

  const isDev = process.env.NODE_ENV !== 'production';

  const clientMetadata = isDev
    ? buildAtprotoLoopbackClientMetadata({
        scope: OAUTH_SCOPE,
        redirect_uris: ['http://127.0.0.1:3000/api/oauth/callback'],
      })
    : {
        client_id: `${process.env.NEXT_PUBLIC_APP_URL}/client-metadata.json`,
        client_name: 'Blueline Hockey',
        client_uri: process.env.NEXT_PUBLIC_APP_URL!,
        redirect_uris: [`${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: OAUTH_SCOPE,
        token_endpoint_auth_method: 'none',
        application_type: 'web',
      };

  globalAuth.oauthClient = new NodeOAuthClient({
    clientMetadata: clientMetadata as any,
    plcDirectoryUrl: 'https://plc.directory',
    handleResolver: 'https://bsky.social',
    stateStore: {
      async get(key: string) {
        return globalAuth.stateStore?.get(key);
      },
      async set(key: string, value: NodeSavedState) {
        globalAuth.stateStore?.set(key, value);
      },
      async del(key: string) {
        globalAuth.stateStore?.delete(key);
      },
    },
    sessionStore: {
      async get(key: string) {
        return globalAuth.sessionStore?.get(key);
      },
      async set(key: string, value: NodeSavedSession) {
        globalAuth.sessionStore?.set(key, value);
      },
      async del(key: string) {
        globalAuth.sessionStore?.delete(key);
      },
    },
  });

  return globalAuth.oauthClient;
}