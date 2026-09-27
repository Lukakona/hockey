import { NextRequest, NextResponse } from 'next/server';
import { getClientMetadata, resolveAppUrl } from '@/lib/bluesky/oauth-config';

/**
 * Serves the OAuth client metadata document.
 *
 * This must live at the exact path advertised as `client_id` by the OAuth
 * client (`CLIENT_METADATA_PATH`), and the `client_id` it returns must equal the
 * URL it is served from — the authorization server fetches this document during
 * login and refuses unknown clients.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const metadata = getClientMetadata(resolveAppUrl(req));

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
