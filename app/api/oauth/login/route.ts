import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient } from '@/lib/bluesky/bluesky-oauth';

export async function POST(req: NextRequest) {
  try {
    const { handle } = await req.json();

    if (!handle) {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }

    const client = await getOAuthClient();
    const url = await client.authorize(handle, {
      scope: 'atproto transition:generic',
    });

    return NextResponse.json({ redirectUrl: url.toString() });
  } catch (err: any) {
    console.error('OAuth Login Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to initialize login' }, { status: 500 });
  }
}