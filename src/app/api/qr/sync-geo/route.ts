// Client-supplied location cannot overwrite another visitor's scan evidence.
// Signed QR checks remain available through /verify and /api/qr/verify.
export async function POST() {
  return Response.json({ error: 'Client location synchronization has been retired. Scan records are not changed by this endpoint.' }, { status: 410 });
}
