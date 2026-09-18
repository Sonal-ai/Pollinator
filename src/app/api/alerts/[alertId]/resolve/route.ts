import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveAlert } from '@/lib/anti-clone';

// POST /api/alerts/[alertId]/resolve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const { alertId } = await params;

  const session = request.cookies.get('pollinator_session');
  if (!session) return new Response('Unauthorized', { status: 401 });

  let resolvedBy = 'ADMIN';
  try {
    const parsed = JSON.parse(Buffer.from(session.value, 'base64').toString()) as { walletAddress?: string; role?: string };
    if (parsed.role !== 'admin') {
      return new Response('Forbidden. Only admins can resolve alerts.', { status: 403 });
    }
    resolvedBy = parsed.walletAddress ?? 'ADMIN';
  } catch {
    return new Response('Invalid session', { status: 401 });
  }

  const alert = await prisma.scanAlert.findUnique({ where: { id: alertId } });
  if (!alert) return Response.json({ error: 'Alert not found' }, { status: 404 });
  if (alert.resolved) return Response.json({ error: 'Alert already resolved' }, { status: 409 });

  await resolveAlert(alertId, resolvedBy);
  return Response.json({ success: true, resolvedBy });
}
