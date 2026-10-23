import { prisma } from '@/lib/db';
import { assertDeployment, deploymentConfig } from '@/lib/deployment/identity';
import Redis from 'ioredis';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  let redis: Redis | undefined, timer: ReturnType<typeof setTimeout> | undefined, expired = false;
  try {
    const checks = async () => {
      await prisma.$queryRaw`SELECT 1`;
      if (process.env.DEPLOYMENT_ADMIN_ADDRESS) await prisma.$queryRaw`SELECT d."id",s."id" FROM "RegistryDeployment" d,"RegistryDeploymentStep" s LIMIT 0`;
      if (process.env.WHATSAPP_PHONE_ID) {
        if (!process.env.WHATSAPP_APP_SECRET || !process.env.WHATSAPP_VERIFY_TOKEN) throw new Error('WhatsApp verification unavailable');
        await prisma.$queryRaw`SELECT i."id",o."id",a."id",c."waId",d."appliedAt",r."id"
          FROM "WhatsAppInbox" i,"WhatsAppOutbox" o,"WhatsAppSendAttempt" a,"WhatsAppConversation" c,"WhatsAppDeliveryEvent" d,"WhatsAppReviewEvent" r LIMIT 0`;
      }
      if (process.env.HONEYCHAIN_CLUSTER_MODE === 'isolated') await assertDeployment(prisma, deploymentConfig());
      if (expired) throw new Error('Readiness timeout');
      if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) throw new Error('Redis unavailable');
      if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, commandTimeout: 2000, maxRetriesPerRequest: 0, retryStrategy: () => null, enableOfflineQueue: false });
        redis.on('error', () => {});
        await redis.connect(); await redis.ping();
      }
    };
    await Promise.race([checks(), new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error('Readiness timeout')); }, 3500); })]);
    return Response.json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  finally { if (timer) clearTimeout(timer); redis?.disconnect(); }
}
