import { NextRequest, NextResponse } from 'next/server';
import { createOAuthClient } from '@/lib/bluesky/bluesky-oauth';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { BskyAgent } from '@atproto/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { client, appUrl, commit } = createOAuthClient(req);

  try {
    const params = new URLSearchParams(req.nextUrl.search);

    // process Callback
    const { session } = await client.callback(params);
    const userDid = session.did;

    // Fetch profile
    const publicAgent = new BskyAgent({ service: 'https://public.api.bsky.app' });
    const profileRes = await publicAgent.getProfile({ actor: userDid });
    const profile = profileRes.data;

    const handle = profile.handle || userDid;
    const avatar = profile.avatar || '';
    const displayName = profile.displayName || handle;

    //Read existing user
    const supabase = await createClient();

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, bsky_did')
      .eq('bsky_did', userDid)
      .maybeSingle();

    let userId = existingProfile?.id;

    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

    if (!userId) {
      const sanitizedDid = userDid.replaceAll(':', '.');
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: `${sanitizedDid}@bsky.internal.com`,
        email_confirm: true,
        user_metadata: { bsky_did: userDid, handle },
      });

      if (authError || !authUser.user) {
        console.error('Failed to create Supabase Auth user:', authError);
        throw authError;
      }

      userId = authUser.user.id;
    }

    // upsert
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: userId,
        bsky_did: userDid,
        username: handle,
        display_name: displayName,
        avatar_url: avatar || null,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.error('Supabase Profile Upsert Error:', profileError.message);
    }

    // back 2 da honky
    const redirectUrl = new URL('/', appUrl.origin);
    redirectUrl.searchParams.set('did', userDid);
    redirectUrl.searchParams.set('handle', handle);
    if (avatar) redirectUrl.searchParams.set('avatar', avatar);

    const res = NextResponse.redirect(redirectUrl);

    const cookieOptions = {
      httpOnly: false,
      path: '/',
      sameSite: 'lax' as const,
      secure: appUrl.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 7,
    };

    res.cookies.set('bsky_did', userDid, cookieOptions);
    res.cookies.set('bsky_handle', handle, cookieOptions);
    res.cookies.set('bsky_avatar', avatar, cookieOptions);

    commit(res);
    return res;
  } catch (error: unknown) {
    console.error('OAuth Callback Error:', error);

    const failureUrl = new URL('/', appUrl.origin);
    failureUrl.searchParams.set('error', 'auth_failed');

    const res = NextResponse.redirect(failureUrl);
    commit(res);
    return res;
  }
}