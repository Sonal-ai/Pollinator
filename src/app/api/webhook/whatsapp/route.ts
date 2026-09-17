import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { whatsapp } from '@/lib/whatsapp/client';
import { fsm, ConversationState } from '@/lib/whatsapp/fsm';
import { analyzeIncomingText, generateBeekeepingAdvice } from '@/lib/whatsapp/bedrock';

// Verify Webhook for Meta
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Verification failed', { status: 403 });
}

// Receive Messages
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256') || '';

  // Verify Signature
  if (process.env.WHATSAPP_APP_SECRET) {
    const expectedSig = crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
      .update(body)
      .digest('hex');
    
    if (`sha256=${expectedSig}` !== signature) {
      console.error('Invalid signature');
      return new NextResponse('OK', { status: 200 }); // Meta requires 200 even on fail
    }
  }

  const payload = JSON.parse(body);

  if (payload.entry) {
    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        for (const message of messages) {
          // Process asynchronously to not block Meta webhook response
          processMessage(message).catch(console.error);
        }
      }
    }
  }

  return new NextResponse('OK', { status: 200 });
}

async function processMessage(message: any) {
  const waId = message.from;
  const msgId = message.id;

  if (await fsm.isDuplicateMessage(msgId)) return;
  await whatsapp.markAsRead(msgId);

  let text = '';
  if (message.type === 'text') {
    text = message.text?.body || '';
  }

  const llmResult = await analyzeIncomingText(text);
  const intent = llmResult.intent;

  const session = await fsm.getSession(waId);
  let state = session.state;

  if (intent === 'MAIN_MENU' || text.toLowerCase() === 'menu') {
    const buttons = [
      { type: 'reply', reply: { id: 'health', title: 'Bee Health' } },
      { type: 'reply', reply: { id: 'market', title: 'Harvest & Market' } }
    ];
    await whatsapp.sendButtons(waId, 'Welcome to Pollinator! How can I help?', buttons);
    await fsm.setSession(waId, ConversationState.MAIN_MENU);
    return;
  }

  if (intent === 'ASK_DOUBT') {
    const advice = await generateBeekeepingAdvice(llmResult.translated_english_text);
    await whatsapp.sendText(waId, advice);
    return;
  }

  if (state === ConversationState.MAIN_MENU) {
    if (message.interactive?.button_reply?.id === 'health') {
      await whatsapp.sendText(waId, 'Hive 1 is Healthy (35C, 45% Humidity).');
    } else if (message.interactive?.button_reply?.id === 'market') {
      await whatsapp.sendText(waId, 'Current Mustard Honey price is ₹150/kg.');
    }
  } else {
    await whatsapp.sendText(waId, "I didn't quite catch that. Type 'menu' to see options.");
  }
}
