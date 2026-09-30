import { buildAtprotoLoopbackClientMetadata } from '@atproto/oauth-client-node';
import type { OAuthClientMetadataInput } from '@atproto/oauth-client-node';
import type { NextRequest } from 'next/server';

/**
 * Single source of truth for the Bluesky / AT Protocol OAuth configuration.
 *
 * Both the OAuth client (used by the API routes) and the public client metadata
 * route import from here so the `client_id` URL can never drift out of sync with
 * the route that actually serves the metadata document (which is what broke the
 * hosted deployment).
 */

/**
 * Scopes requested during login.
 */
export const OAUTH_SCOPE = 'atproto';

/** Route that serves the OAuth client metadata document (the `client_id` URL). */
export const CLIENT_METADATA_PATH = '/oauth-client-metadata.json';

/** Route the authorization server redirects back to after the user approves. */
export const CALLBACK_PATH = '/api/oauth/callback';

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

export function isLoopbackUrl(url: URL): boolean {
  return isLoopbackHostname(url.hostname);
}

/**
 * Reads `NEXT_PUBLIC_APP_URL`.
 *
 * NOTE: Next.js inlines `NEXT_PUBLIC_*` values into the bundle at **build**
 * time, so this is a build-time setting, not a runtime one. Use `APP_URL`
 * instead when the same build artifact is deployed to several environments.
 */
export function getConfiguredAppUrl(): URL | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_APP_URL is not a valid absolute URL: "${raw}". ` +
        `Expected something like "https://hockey.lukakona.online".`
    );
  }
}

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim();
  return first ? first : null;
}

function hostnameOf(host: string): string {
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end === -1 ? host : host.slice(0, end + 1);
  }
  return host.split(':')[0];
}

/**
 * Resolves the public origin of the app.
 *
 * Order of preference:
 *  1. `APP_URL` — a server-only variable, read at runtime. The right choice for
 *     containers/deployments where one build serves several environments.
 *  2. The incoming request (via `X-Forwarded-*`, then `Host`). This keeps the
 *     `client_id` and `redirect_uri` on whichever host the browser actually
 *     used, so no configuration is required behind a reverse proxy.
 *  3. `NEXT_PUBLIC_APP_URL` — build-time fallback when there is no request.
 *  4. Loopback, for local development.
 */
export function resolveAppUrl(request?: NextRequest): URL {
  const runtimeOverride = process.env.APP_URL?.trim();
  if (runtimeOverride) {
    try {
      return new URL(runtimeOverride);
    } catch {
      throw new Error(
        `APP_URL is not a valid absolute URL: "${runtimeOverride}". ` +
          `Expected something like "https://hockey.lukakona.online".`
      );
    }
  }

  if (request) {
    const host =
      firstHeaderValue(request.headers.get('x-forwarded-host')) ??
      firstHeaderValue(request.headers.get('host'));

    if (host) {
      const isLoopback = isLoopbackHostname(hostnameOf(host));
      // A public host is assumed to be HTTPS unless the proxy says otherwise.
      const proto =
        firstHeaderValue(request.headers.get('x-forwarded-proto')) ??
        (isLoopback ? 'http' : 'https');

      try {
        return new URL(`${proto}://${host}`);
      } catch {
        // Fall through to the origin Next.js derived for this request.
      }
    }

    if (request.nextUrl?.origin) {
      return new URL(request.nextUrl.origin);
    }
  }

  const configured = getConfiguredAppUrl();
  if (configured) return configured;

  return new URL('http://127.0.0.1:3000');
}

/**
 * Builds the OAuth client metadata for the given app origin.
 *
 * - Loopback origins (local `next dev` / `next start`) use AT Protocol's
 *   loopback client metadata. The spec forbids `http:` and IP-address
 *   `client_id`s for hosted clients, which is what made a local production
 *   build fail with a ZodError.
 * - Hosted origins must be HTTPS and advertise themselves via a discoverable
 *   `client_id` URL that returns this exact document.
 */
export function getClientMetadata(appUrl: URL = resolveAppUrl()): OAuthClientMetadataInput {
  const redirectUri = new URL(CALLBACK_PATH, appUrl).toString();

  if (isLoopbackUrl(appUrl)) {
    return buildAtprotoLoopbackClientMetadata({
      scope: OAUTH_SCOPE,
      redirect_uris: [redirectUri],
    });
  }

  if (appUrl.protocol !== 'https:') {
    throw new Error(
      `Bluesky OAuth requires HTTPS for non-loopback hosts, but the resolved app origin is ` +
        `"${appUrl.origin}". Serve the app over HTTPS (or set APP_URL to the public HTTPS ` +
        `origin, for example "https://hockey.lukakona.online").`
    );
  }

  return {
    client_id: new URL(CLIENT_METADATA_PATH, appUrl).toString(),
    client_name: 'Blueline Hockey',
    client_uri: appUrl.origin,
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: OAUTH_SCOPE,
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  };
}
