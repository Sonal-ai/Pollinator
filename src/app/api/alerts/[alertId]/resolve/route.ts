import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveAlert } from '@/lib/anti-clone';

// POST /api/alerts/[alertId]/resolve
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const { alertId } = await params;

  const { getSession } = await import('@/lib/auth');
  const session = await getSession();

  if (!session) return new Response('Unauthorized', { status: 401 });
  if (session.role !== 'admin') {
    return new Response('Forbidden. Only admins can resolve alerts.', { status: 403 });
  }

  const resolvedBy = session.walletAddress ?? 'ADMIN';

  const alert = await prisma.scanAlert.findUnique({ where: { id: alertId } });
  if (!alert) return Response.json({ error: 'Alert not found' }, { status: 404 });
  if (alert.resolved) return Response.json({ error: 'Alert already resolved' }, { status: 409 });

  await resolveAlert(alertId, resolvedBy);
  return Response.json({ success: true, resolvedBy });
}
