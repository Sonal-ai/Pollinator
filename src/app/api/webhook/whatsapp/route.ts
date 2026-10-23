import { env } from '@/lib/env';
import { createWebhookHandlers } from '@/lib/whatsapp/webhook';
import { WhatsAppStore } from '@/lib/whatsapp/store';

export const runtime = 'nodejs';
function handlers() {
  return createWebhookHandlers({verifyToken: env.WHATSAPP_VERIFY_TOKEN, appSecret: env.WHATSAPP_APP_SECRET,
    phoneId: env.WHATSAPP_PHONE_ID, store: new WhatsAppStore()});
}
export async function GET(request: Request) {
  try { return await handlers().GET(request); } catch { return new Response('Webhook configuration unavailable', {status: 503}); }
}
export async function POST(request: Request) {
  try { return await handlers().POST(request); } catch { return new Response('Webhook configuration unavailable', {status: 503}); }
}
