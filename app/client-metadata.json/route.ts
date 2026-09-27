import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Extract host dynamically from incoming request headers or fallback to env
  const host =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin ||
    'https://hockey.lukakona.online';

  return NextResponse.json(
    {
      client_id: `${host}/client-metadata.json`,
      client_name: 'Blueline Hockey',
      client_uri: host,
      redirect_uris: [`${host}/api/oauth/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'atproto transition:generic',
      token_endpoint_auth_method: 'none',
      application_type: 'web',
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}