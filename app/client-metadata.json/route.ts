import { NextResponse } from 'next/server';

export async function GET() {
  const host = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

  return NextResponse.json({
    client_id: `${host}/client-metadata.json`,
    client_name: 'Blueline Hockey',
    client_uri: host,
    redirect_uris: [`${host}/api/oauth/callback`],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'atproto',
    token_endpoint_auth_method: 'none',
    application_type: 'web',
  });
}