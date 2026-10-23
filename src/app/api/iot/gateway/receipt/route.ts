import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createGatewayHandler } from '@/lib/telemetry/gateway-handler';

export const runtime = 'nodejs';
export const POST = createGatewayHandler({ db: prisma, session: getSession, statusOnly: true,
  publish: async () => { throw new Error('Receipt lookup must never publish.'); } });
