import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOAuthClient } from '@/lib/bluesky/bluesky-oauth';
import { createClient } from '@/lib/supabase/server';
import { BskyAgent } from '@atproto/api';

export async function GET(req: NextRequest) {
  try {
    const client = getOAuthClient();
    const params = new URLSearchParams(req.nextUrl.search);

    // 1. Process Bluesky OAuth Callback & obtain session
    const { session } = await client.callback(params);
    const userDid = session.did;

    // 2. Fetch public profile using unauthenticated BskyAgent
    const publicAgent = new BskyAgent({ service: 'https://public.api.bsky.app' });
    const profileRes = await publicAgent.getProfile({ actor: userDid });
    const profile = profileRes.data;

    const handle = profile.handle || userDid;
    const avatar = profile.avatar || '';
    const displayName = profile.displayName || handle;

    // 3. Upsert into Supabase database
    const supabase = await createClient();
    await supabase.from('profiles').upsert(
      {
        did: userDid,
        handle: handle,
        display_name: displayName,
        avatar_url: avatar,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'did' }
    );

    // 4. Set cookies via Next.js cookie store
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: false,
      path: '/',
      sameSite: 'lax' as const,
      secure: false,
      maxAge: 60 * 60 * 24 * 7,
    };

    cookieStore.set('bsky_did', userDid, cookieOptions);
    cookieStore.set('bsky_handle', handle, cookieOptions);
    cookieStore.set('bsky_avatar', avatar, cookieOptions);

    // 5. Redirect back with URL parameters so the client gets the data even if cookies are dropped
    const redirectUrl = new URL('/', req.nextUrl.origin);
    redirectUrl.searchParams.set('did', userDid);
    redirectUrl.searchParams.set('handle', handle);
    if (avatar) redirectUrl.searchParams.set('avatar', avatar);

    const res = NextResponse.redirect(redirectUrl);
    
    // Set on response object as well
    res.cookies.set('bsky_did', userDid, cookieOptions);
    res.cookies.set('bsky_handle', handle, cookieOptions);
    res.cookies.set('bsky_avatar', avatar, cookieOptions);

    return res;
  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(new URL('/?error=auth_failed', req.nextUrl.origin));
  }
}