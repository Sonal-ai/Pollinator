// DEPRECATED: QR verification is now handled by the page at /verify
// This API route is kept for backward compatibility only
import { NextRequest } from 'next/server';

export async function POST(_request: NextRequest) {
  return Response.json(
    { error: 'This API endpoint is deprecated. QR verification is handled at /verify?b=...&n=...&sig=...' },
    { status: 410 }
  );
}
