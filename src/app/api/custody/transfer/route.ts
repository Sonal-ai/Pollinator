// DEPRECATED: This route has been superseded by POST /api/custody
// Kept as a redirect to avoid 404s on old integrations
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  return Response.json(
    { error: 'This endpoint is deprecated. Use POST /api/custody instead.' },
    { status: 410 }
  );
}
