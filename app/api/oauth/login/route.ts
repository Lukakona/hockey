import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient, OAUTH_SCOPE } from '@/lib/bluesky/bluesky-oauth';

/**
 * Errors that mean "the user typed a handle we can't look up", as opposed to a
 * server misconfiguration. These map to 400 so the UI can show a useful hint.
 */
const HANDLE_ERROR_NAMES = new Set([
  'HandleResolverError',
  'IdentityResolverError',
  'OAuthResolverError',
  'DidResolverError',
  'PoorlyFormattedDidError',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const handle = typeof body?.handle === 'string' ? body.handle.trim() : '';

    if (!handle) {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }

    const { client, commit } = createOAuthClient(req);

    // `authorize` resolves the handle and returns the URL the browser must be
    // sent to (including the PKCE challenge, state and DPoP key).
    const url = await client.authorize(handle, { scope: OAUTH_SCOPE });

    const response = NextResponse.json(
      // The client reads `url`. `redirectUrl` is kept as an alias so any older
      // caller keeps working.
      { url: url.toString(), redirectUrl: url.toString() },
      { headers: { 'Cache-Control': 'no-store' } }
    );

    // Persist the pending OAuth handshake (state + DPoP key) as a cookie so the
    // callback can complete the flow on any server instance.
    commit(response);

    return response;
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    const isHandleError = error?.name ? HANDLE_ERROR_NAMES.has(error.name) : false;

    console.error('OAuth Login Error:', err);

    if (isHandleError) {
      return NextResponse.json(
        { error: `Could not find a Bluesky account for that handle.` },
        { status: 400 }
      );
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return NextResponse.json(
      {
        error: isDev
          ? error?.message || 'Failed to initialize login'
          : 'Failed to initialize login. Please try again later.',
      },
      { status: 500 }
    );
  }
}