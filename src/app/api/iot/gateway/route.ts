import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createGatewayHandler } from '@/lib/telemetry/gateway-handler';
import { publishGatewayPacket } from '@/lib/telemetry/gateway-publisher';

export const runtime = 'nodejs';
export const POST = createGatewayHandler({ db: prisma, session: getSession, publish: publishGatewayPacket });
