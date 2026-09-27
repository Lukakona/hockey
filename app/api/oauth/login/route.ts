import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient } from '@/lib/bluesky/bluesky-oauth';

export async function POST(req: NextRequest) {
  try {
    const { handle } = await req.json();
    if (!handle) {
      return NextResponse.json({ error: 'Handle required' }, { status: 400 });
    }

    const client = getOAuthClient();
    const url = await client.authorize(handle, { scope: 'atproto' });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Bluesky OAuth login error:', error);
    return NextResponse.json({ error: 'Failed to authorize user' }, { status: 500 });
  }
}