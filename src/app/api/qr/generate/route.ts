// DEPRECATED: This route has been superseded by POST /api/qr
// Kept to avoid 404s on old integrations
import { NextRequest } from 'next/server';

export async function POST(_request: NextRequest) {
  return Response.json(
    { error: 'This endpoint is deprecated. Use POST /api/qr instead.' },
    { status: 410 }
  );
}
