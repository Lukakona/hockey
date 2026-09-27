import { NextResponse } from 'next/server';
import { BskyAgent } from '@atproto/api';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { handle, appPassword } = await request.json();

    if (!handle || !appPassword) {
      return NextResponse.json(
        { error: 'Handle and App Password are required.' },
        { status: 400 }
      );
    }

    // 1. Authenticate against Bluesky / AT Protocol
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    const loginRes = await agent.login({
      identifier: handle,
      password: appPassword,
    });

    if (!loginRes.success) {
      return NextResponse.json({ error: 'Invalid Bluesky credentials.' }, { status: 401 });
    }

    // 2. Fetch profile info (avatar, display name)
    const profileRes = await agent.getProfile({ actor: agent.session?.did! });
    const bskyProfile = profileRes.data;

    const supabase = await createClient();

    // 3. Upsert user into Supabase profiles table using Bluesky DID as unique ID
    const { data: userProfile, error } = await supabase
      .from('profiles')
      .upsert(
        {
          bsky_did: bskyProfile.did,
          username: bskyProfile.handle,
          display_name: bskyProfile.displayName || bskyProfile.handle,
          avatar_url: bskyProfile.avatar || null,
          // Give new users 1000 starting tokens if they don't exist yet
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'bsky_did' }
      )
      .select()
      .single();

    if (error) {
      console.error('Supabase Profile Upsert Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: userProfile,
    });
  } catch (err: any) {
    console.error('Bluesky Auth Error:', err);
    return NextResponse.json({ error: err.message || 'Authentication failed' }, { status: 500 });
  }
}