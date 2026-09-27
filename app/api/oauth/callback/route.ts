import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient } from '@/lib/bluesky/bluesky-oauth';
import { createClient } from '@/lib/supabase/server';
import { BskyAgent } from '@atproto/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { client, appUrl, commit } = createOAuthClient(req);

  try {
    const params = new URLSearchParams(req.nextUrl.search);

    // 1. Process the Bluesky OAuth callback & obtain the session. This reads the
    //    handshake written by /api/oauth/login from the state cookie.
    const { session } = await client.callback(params);
    const userDid = session.did;

    // 2. Fetch the public profile using an unauthenticated BskyAgent
    const publicAgent = new BskyAgent({ service: 'https://public.api.bsky.app' });
    const profileRes = await publicAgent.getProfile({ actor: userDid });
    const profile = profileRes.data;

    const handle = profile.handle || userDid;
    const avatar = profile.avatar || '';
    const displayName = profile.displayName || handle;

    // 3. Upsert into Supabase. A failure here should not block sign-in, so it is
    //    logged rather than thrown.
    const supabase = await createClient();
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        bsky_did: userDid,
        username: handle,
        display_name: displayName,
        avatar_url: avatar || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'bsky_did' }
    );

    if (profileError) {
      console.error('Supabase Profile Upsert Error:', profileError.message);
    }

    // 4. Redirect back to the app, carrying the identity in the URL so the client
    //    has it even if cookies are unavailable.
    const redirectUrl = new URL('/', appUrl.origin);
    redirectUrl.searchParams.set('did', userDid);
    redirectUrl.searchParams.set('handle', handle);
    if (avatar) redirectUrl.searchParams.set('avatar', avatar);

    const res = NextResponse.redirect(redirectUrl);

    // 5. Mirror the identity into readable cookies so it survives reloads.
    const cookieOptions = {
      httpOnly: false, // Read by the client via document.cookie.
      path: '/',
      sameSite: 'lax' as const,
      secure: appUrl.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 7,
    };

    res.cookies.set('bsky_did', userDid, cookieOptions);
    res.cookies.set('bsky_handle', handle, cookieOptions);
    res.cookies.set('bsky_avatar', avatar, cookieOptions);

    // 6. Persist the AT Protocol session (and clear the consumed state cookie).
    commit(res);

    return res;
  } catch (error: unknown) {
    console.error('OAuth Callback Error:', error);

    const failureUrl = new URL('/', appUrl.origin);
    failureUrl.searchParams.set('error', 'auth_failed');

    const res = NextResponse.redirect(failureUrl);
    // Still flush, so a consumed or invalid state cookie is cleaned up.
    commit(res);

    return res;
  }
}