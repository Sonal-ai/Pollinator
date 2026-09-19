import { prisma } from '../db';
import {
  ConversationState,
  SessionData,
  fsm,
  type Session,
} from './fsm';
import {
  analyzeIncomingText,
  generateBeekeepingAdvice,
  translateResponse,
  type SupportedLanguage,
} from './bedrock';
import { whatsapp } from './client';
import { getExplorerTxUrl } from '../blockchain';

// ============================================================
// Incoming Message Shape (Meta Webhook)
// ============================================================

interface MetaMessage {
  id: string;
  from: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'image' | 'audio' | 'button';
  text?: { body: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  image?: { id: string; mime_type: string };
  audio?: { id: string; mime_type: string };
  button?: { payload: string; text: string };
}

interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaMessage[];
      };
    }>;
  }>;
}

// ============================================================
// Localised String Maps
// ============================================================
// Use static strings for structured messages (buttons, prompts).
// Only use Bedrock translation for freeform AI answers.

type StringValue = string | ((...args: unknown[]) => string);
const STRINGS: Record<SupportedLanguage, Record<string, StringValue>> = {
  en: {
    welcome_new:      '👋 Welcome to *Pollinator*! The honey supply chain platform.\n\nLet\'s get you registered.',
    welcome_back:     '🐝 Welcome back! How can I help you today?',
    ask_name:         'What is your name?',
    ask_region:       'Which state or district are you from? (e.g. Wardha, Maharashtra)',
    ask_hive_count:   'How many hives do you have?',
    ask_practices:    'What type of beekeeping do you practice? (e.g. Apis cerana, Apis mellifera)',
    registration_done:'✅ You\'re registered! Here\'s your main menu:',
    harvest_type:     '🍯 What type of honey is this harvest? (e.g. Mustard, Litchi, Multiflora)',
    harvest_quantity: '⚖️ How many grams of honey did you harvest? (Enter a number)',
    harvest_confirm:  ((type: string, grams: number) =>
                        `Confirm harvest:\n🍯 Type: ${type}\n⚖️ Quantity: ${(grams/1000).toFixed(2)} kg\n\nIs this correct?`) as StringValue,
    harvest_success:  ((code: string, tx: string) => {
      const explorerUrl = getExplorerTxUrl(tx);
      const linkText = explorerUrl ? `View on Polygonscan: ${explorerUrl}` : `Local Hardhat TX: ${tx.slice(0, 14)}...`;
      return `✅ *Harvest registered on blockchain!*\n\nBatch Code: \`${code}\`\n${linkText}`;
    }) as StringValue,
    harvest_cancel:   '❌ Harvest cancelled. Returning to main menu.',
    market_info:      '💰 *Current Honey Market Rates (approx.)*\n\n• Mustard: ₹100–130/kg\n• Litchi: ₹150–180/kg\n• Multiflora: ₹90–120/kg\n\nKVIC procurement: Contact your nearest KVIC office.\nNational Bee Board: https://nbb.gov.in',
    ask_question:     '❓ Please type your beekeeping question:',
    hive_no_data:     '📡 No sensor data found for your hives yet. Make sure your IoT device is connected.',
    error_generic:    '⚠️ Something went wrong. Please try again.',
    invalid_number:   '⚠️ Please enter a valid number.',
    btn_hive_status:  '🌡️ Hive Status',
    btn_bee_health:   '🐝 Bee Health',
    btn_harvest:      '🍯 Log Harvest',
    btn_market:       '💰 Market Info',
    btn_ask:          '❓ Ask a Question',
    btn_yes:          '✅ Yes',
    btn_no:           '❌ No',
    btn_register_hive:'📲 Pair IoT Hive',
    ask_device_id:    'Please type the Device ID printed on your Hive Sensor (e.g. ESP32-001):',
    hive_registered:  '✅ Hive paired successfully! You will now receive sensor updates.',
  },
  hi: {
    welcome_new:      '👋 *Pollinator* में आपका स्वागत है! शहद आपूर्ति श्रृंखला प्लेटफ़ॉर्म।\n\nआइए आपका पंजीकरण करें।',
    welcome_back:     '🐝 वापस स्वागत है! आज मैं आपकी कैसे मदद कर सकता हूँ?',
    ask_name:         'आपका नाम क्या है?',
    ask_region:       'आप किस राज्य या ज़िले से हैं? (जैसे वर्धा, महाराष्ट्र)',
    ask_hive_count:   'आपके पास कितने मधुमक्खी के छत्ते हैं?',
    ask_practices:    'आप किस प्रकार की मधुमक्खी पालन करते हैं? (जैसे Apis cerana, Apis mellifera)',
    registration_done:'✅ आपका पंजीकरण हो गया! यहाँ आपका मुख्य मेनू है:',
    harvest_type:     '🍯 यह फसल किस प्रकार का शहद है? (जैसे सरसों, लीची, मल्टीफ्लोरा)',
    harvest_quantity:  '⚖️ आपने कितने ग्राम शहद काटा? (एक संख्या दर्ज करें)',
    harvest_confirm:  ((type: string, grams: number) =>
                        `फसल की पुष्टि करें:\n🍯 प्रकार: ${type}\n⚖️ मात्रा: ${(grams/1000).toFixed(2)} किग्रा\n\nक्या यह सही है?`) as StringValue,
    harvest_success:  ((code: string, tx: string) => {
      const explorerUrl = getExplorerTxUrl(tx);
      const linkText = explorerUrl ? `Polygonscan पर देखें: ${explorerUrl}` : `लोकल ब्लॉकचेन TX: ${tx.slice(0, 14)}...`;
      return `✅ *फसल ब्लॉकचेन पर दर्ज हो गई!*\n\nबैच कोड: \`${code}\`\n${linkText}`;
    }) as StringValue,
    harvest_cancel:   '❌ फसल रद्द। मुख्य मेनू पर वापस।',
    market_info:      '💰 *वर्तमान शहद बाज़ार दरें (अनुमानित)*\n\n• सरसों: ₹100–130/किग्रा\n• लीची: ₹150–180/किग्रा\n• मल्टीफ्लोरा: ₹90–120/किग्रा',
    ask_question:     '❓ कृपया अपना मधुमक्खी पालन प्रश्न लिखें:',
    hive_no_data:     '📡 अभी तक आपके छत्तों का कोई सेंसर डेटा नहीं मिला।',
    error_generic:    '⚠️ कुछ गड़बड़ हुई। कृपया पुनः प्रयास करें।',
    invalid_number:   '⚠️ कृपया एक वैध संख्या दर्ज करें।',
    btn_hive_status:  '🌡️ छत्ते की स्थिति',
    btn_bee_health:   '🐝 मधुमक्खी स्वास्थ्य',
    btn_harvest:      '🍯 फसल दर्ज करें',
    btn_market:       '💰 बाज़ार जानकारी',
    btn_ask:          '❓ प्रश्न पूछें',
    btn_yes:          '✅ हाँ',
    btn_no:           '❌ नहीं',
    btn_register_hive:'📲 IoT छत्ता जोड़ें',
    ask_device_id:    'कृपया अपने छत्ता सेंसर पर मुद्रित डिवाइस आईडी टाइप करें (जैसे ESP32-001):',
    hive_registered:  '✅ छत्ता सफलतापूर्वक जुड़ गया! अब आपको सेंसर अपडेट मिलेंगे।',
  },
  // Other languages: fall back to English for now; add translations iteratively
  te: {} as Record<string, string>,
  bn: {} as Record<string, string>,
  mr: {} as Record<string, string>,
  ta: {} as Record<string, string>,
};

function t(lang: SupportedLanguage, key: string, ...args: unknown[]): string {
  const str = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (typeof str === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (str as (...a: unknown[]) => string)(...args);
  }
  return str;
}

// ============================================================
// Main Entry Point
// ============================================================

export async function handleIncomingMessage(body: MetaWebhookBody): Promise<void> {
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return;

  const waId = message.from;
  const msgId = message.id;

  // Deduplication — Meta sometimes sends the same webhook twice
  if (await fsm.isDuplicateMessage(msgId)) return;

  // Mark as read immediately (async, don't await)
  void whatsapp.markAsRead(msgId).catch(() => {});

  const session = await fsm.getSession(waId);
  const lang = (session.data.language as SupportedLanguage) || 'en';

  // Extract the text content from the message regardless of type
  const incomingText = extractText(message);

  try {
    await route(waId, message, session, lang, incomingText);
  } catch (err) {
    console.error('[handler] Message routing error:', err);
    await whatsapp.sendText(waId, t(lang, 'error_generic'));
  }
}

// ============================================================
// Message Router (State Machine)
// ============================================================

async function route(
  waId: string,
  message: MetaMessage,
  session: Session,
  lang: SupportedLanguage,
  text: string
): Promise<void> {
  const state = session.state;

  // ----------------------------------------------------------
  // IDLE / ONBOARDING — first contact or reset
  // ----------------------------------------------------------
  if (state === ConversationState.IDLE || state === ConversationState.ONBOARDING) {
    // Check if beekeeper already registered
    const beekeeper = await prisma.beekeeper.findUnique({
      where: { phone: waId },
    });

    if (beekeeper) {
      await fsm.setSession(waId, ConversationState.MAIN_MENU, {
        beekeeper_id: beekeeper.id,
        language: lang,
      });
      await sendMainMenu(waId, lang);
    } else {
      // Start registration
      await fsm.setSession(waId, ConversationState.REGISTRATION_NAME, {});
      await whatsapp.sendText(waId, t(lang, 'welcome_new'));
      await whatsapp.sendText(waId, t(lang, 'ask_name'));
    }
    return;
  }

  // ----------------------------------------------------------
  // REGISTRATION FLOW
  // ----------------------------------------------------------
  if (state === ConversationState.REGISTRATION_NAME) {
    if (!text.trim()) {
      await whatsapp.sendText(waId, t(lang, 'ask_name'));
      return;
    }

    // Detect language from their name message
    const analysis = await analyzeIncomingText(text);
    const detectedLang = analysis.detected_language;

    await fsm.setSession(waId, ConversationState.REGISTRATION_REGION, {
      language: detectedLang,
      registration: { name: text.trim() },
    });
    await whatsapp.sendText(waId, t(detectedLang, 'ask_region'));
    return;
  }

  if (state === ConversationState.REGISTRATION_REGION) {
    await fsm.setSession(waId, ConversationState.REGISTRATION_HIVE_COUNT, {
      ...session.data,
      registration: { ...session.data.registration, region: text.trim() },
    });
    await whatsapp.sendText(waId, t(lang, 'ask_hive_count'));
    return;
  }

  if (state === ConversationState.REGISTRATION_HIVE_COUNT) {
    const count = parseInt(text.trim(), 10);
    if (isNaN(count) || count <= 0) {
      await whatsapp.sendText(waId, t(lang, 'invalid_number'));
      return;
    }
    await fsm.setSession(waId, ConversationState.REGISTRATION_PRACTICES, {
      ...session.data,
      registration: { ...session.data.registration, hivesCount: count },
    });
    await whatsapp.sendText(waId, t(lang, 'ask_practices'));
    return;
  }

  if (state === ConversationState.REGISTRATION_PRACTICES) {
    const reg = session.data.registration ?? {};
    
    // Generate a deterministic custodial wallet for the Beekeeper (GAP-06 fix)
    const ethers = await import('ethers');
    const { createHmac } = await import('crypto');
    const { env } = await import('../env');
    
    // Derive a 32-byte private key deterministically from the user's waId
    const privateKeyHex = '0x' + createHmac('sha256', env.WHATSAPP_APP_SECRET).update(waId).digest('hex');
    const beekeeperWallet = new ethers.Wallet(privateKeyHex);

    // Save to DB
    const beekeeper = await prisma.beekeeper.create({
      data: {
        phone: waId,
        name: reg.name ?? 'Unknown',
        region: reg.region ?? '',
        hivesCount: reg.hivesCount ?? 0,
        practices: text.trim(),
        wallet: beekeeperWallet.address,
      },
    });

    await fsm.setSession(waId, ConversationState.MAIN_MENU, {
      language: lang,
      beekeeper_id: beekeeper.id,
    });
    await whatsapp.sendText(waId, `${t(lang, 'registration_done')}\n\n*Your Dashboard Login ID:*\n\`${beekeeperWallet.address}\``);
    await sendMainMenu(waId, lang);
    return;
  }

  // ----------------------------------------------------------
  // MAIN MENU
  // ----------------------------------------------------------
  if (state === ConversationState.MAIN_MENU) {
    // Handle both button replies and text commands
    const buttonId = getButtonId(message);

    if (buttonId === 'menu_hive_status' || text.toLowerCase().includes('hive')) {
      await handleHiveStatus(waId, session.data, lang);
    } else if (buttonId === 'menu_register_hive') {
      await fsm.setSession(waId, ConversationState.REGISTER_HIVE, session.data);
      await whatsapp.sendText(waId, t(lang, 'ask_device_id'));
    } else if (buttonId === 'menu_harvest' || text.toLowerCase().includes('harvest')) {
      await fsm.setSession(waId, ConversationState.HARVEST_TYPE, session.data);
      await whatsapp.sendText(waId, t(lang, 'harvest_type'));
    } else if (buttonId === 'menu_market' || text.toLowerCase().includes('market')) {
      await whatsapp.sendText(waId, t(lang, 'market_info'));
    } else if (buttonId === 'menu_ask' || text.includes('?')) {
      await fsm.setSession(waId, ConversationState.ASK_QUESTION, session.data);
      await whatsapp.sendText(waId, t(lang, 'ask_question'));
    } else {
      // Unknown input — use AI to detect intent
      const analysis = await analyzeIncomingText(text);
      if (analysis.intent === 'HARVEST_MARKET') {
        await fsm.setSession(waId, ConversationState.HARVEST_TYPE, session.data);
        await whatsapp.sendText(waId, t(lang, 'harvest_type'));
      } else if (analysis.intent === 'ASK_DOUBT') {
        await fsm.setSession(waId, ConversationState.ASK_QUESTION, session.data);
        await whatsapp.sendText(waId, t(lang, 'ask_question'));
      } else {
        await sendMainMenu(waId, lang);
      }
    }
    return;
  }

  // ----------------------------------------------------------
  // REGISTER HIVE (IoT Pairing)
  // ----------------------------------------------------------
  if (state === ConversationState.REGISTER_HIVE) {
    const deviceId = text.trim();
    if (session.data.beekeeper_id) {
      await prisma.hive.upsert({
        where: { deviceId },
        update: { beekeeperId: session.data.beekeeper_id },
        create: {
          deviceId,
          beekeeperId: session.data.beekeeper_id,
        },
      });
    }
    await whatsapp.sendText(waId, t(lang, 'hive_registered'));
    await fsm.setSession(waId, ConversationState.MAIN_MENU, session.data);
    await sendMainMenu(waId, lang);
    return;
  }

  // ----------------------------------------------------------
  // HARVEST FLOW
  // ----------------------------------------------------------
  if (state === ConversationState.HARVEST_TYPE) {
    await fsm.setSession(waId, ConversationState.HARVEST_QUANTITY, {
      ...session.data,
      harvest_draft: { honeyType: text.trim() },
    });
    await whatsapp.sendText(waId, t(lang, 'harvest_quantity'));
    return;
  }

  if (state === ConversationState.HARVEST_QUANTITY) {
    const grams = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (isNaN(grams) || grams <= 0) {
      await whatsapp.sendText(waId, t(lang, 'invalid_number'));
      return;
    }

    const draft = session.data.harvest_draft ?? {};
    const honeyType = draft.honeyType ?? 'Unknown';
    const confirmText = t(lang, 'harvest_confirm', honeyType, grams);

    await fsm.setSession(waId, ConversationState.HARVEST_CONFIRM, {
      ...session.data,
      harvest_draft: { ...draft, quantityGrams: grams },
    });

    await whatsapp.sendButtons(waId, confirmText, [
      { type: 'reply', reply: { id: 'harvest_yes', title: t(lang, 'btn_yes') } },
      { type: 'reply', reply: { id: 'harvest_no', title: t(lang, 'btn_no') } },
    ]);
    return;
  }

  if (state === ConversationState.HARVEST_CONFIRM) {
    const buttonId = getButtonId(message);
    if (buttonId === 'harvest_yes' || text.toLowerCase().startsWith('y') || text.includes('हाँ')) {
      await createHarvestBatch(waId, session.data, lang);
    } else {
      await fsm.setSession(waId, ConversationState.MAIN_MENU, session.data);
      await whatsapp.sendText(waId, t(lang, 'harvest_cancel'));
      await sendMainMenu(waId, lang);
    }
    return;
  }

  // ----------------------------------------------------------
  // ASK A QUESTION
  // ----------------------------------------------------------
  if (state === ConversationState.ASK_QUESTION) {
    const analysis = await analyzeIncomingText(text);
    const englishQuestion = analysis.translated_english_text;
    const englishAnswer = await generateBeekeepingAdvice(englishQuestion);
    const localAnswer = await translateResponse(englishAnswer, lang);

    await whatsapp.sendText(waId, localAnswer);
    // Return to main menu after answering
    await fsm.setSession(waId, ConversationState.MAIN_MENU, session.data);
    await sendMainMenu(waId, lang);
    return;
  }

  // ----------------------------------------------------------
  // Default: unhandled state → reset to IDLE
  // ----------------------------------------------------------
  await fsm.setSession(waId, ConversationState.IDLE, {});
  await whatsapp.sendText(waId, t(lang, 'welcome_back'));
  await sendMainMenu(waId, lang);
}

// ============================================================
// Helper Functions
// ============================================================

function extractText(message: MetaMessage): string {
  if (message.type === 'text') return message.text?.body ?? '';
  if (message.type === 'button') return message.button?.payload ?? '';
  if (message.type === 'interactive') {
    return (
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      ''
    );
  }
  return '';
}

function getButtonId(message: MetaMessage): string | null {
  if (message.type === 'interactive') {
    return (
      message.interactive?.button_reply?.id ??
      message.interactive?.list_reply?.id ??
      null
    );
  }
  if (message.type === 'button') return message.button?.payload ?? null;
  return null;
}

async function sendMainMenu(waId: string, lang: SupportedLanguage): Promise<void> {
  // WhatsApp allows max 3 buttons per interactive message
  // We use a list for the full menu
  await whatsapp.sendList(
    waId,
    '🐝 Pollinator',
    t(lang, 'welcome_back'),
    'Open Menu',
    [
      {
        title: 'My Farm',
        rows: [
          { id: 'menu_hive_status', title: t(lang, 'btn_hive_status'), description: 'Live sensor data from your hives' },
          { id: 'menu_register_hive', title: t(lang, 'btn_register_hive'), description: 'Pair a new IoT sensor' },
          { id: 'menu_bee_health', title: t(lang, 'btn_bee_health'), description: 'Upload a bee photo for analysis' },
          { id: 'menu_harvest', title: t(lang, 'btn_harvest'), description: 'Register a honey harvest on blockchain' },
        ],
      },
      {
        title: 'Info & Help',
        rows: [
          { id: 'menu_market', title: t(lang, 'btn_market'), description: 'Current market rates & KVIC info' },
          { id: 'menu_ask', title: t(lang, 'btn_ask'), description: 'Ask a beekeeping question' },
        ],
      },
    ]
  );
}

async function handleHiveStatus(
  waId: string,
  sessionData: SessionData,
  lang: SupportedLanguage
): Promise<void> {
  if (!sessionData.beekeeper_id) {
    await whatsapp.sendText(waId, t(lang, 'hive_no_data'));
    return;
  }

  const hives = await prisma.hive.findMany({
    where: { beekeeperId: sessionData.beekeeper_id },
    include: {
      readings: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
  });

  if (hives.length === 0 || hives.every((h) => h.readings.length === 0)) {
    await whatsapp.sendText(waId, t(lang, 'hive_no_data'));
    return;
  }

  let statusText = '🌡️ *Your Hive Status*\n\n';
  for (const hive of hives) {
    const reading = hive.readings[0];
    if (!reading) continue;
    statusText += `📦 Hive ${hive.deviceId}\n`;
    statusText += `🌡️ Temp: ${reading.tempC?.toFixed(1) ?? 'N/A'}°C\n`;
    statusText += `💧 Humidity: ${reading.humidityPct?.toFixed(1) ?? 'N/A'}%\n`;
    statusText += `⚖️ Weight: ${reading.weightKg?.toFixed(2) ?? 'N/A'} kg\n`;
    statusText += `🔋 Battery: ${reading.batteryPct?.toFixed(0) ?? 'N/A'}%\n\n`;
  }

  await whatsapp.sendText(waId, statusText);
}

async function createHarvestBatch(
  waId: string,
  sessionData: SessionData,
  lang: SupportedLanguage
): Promise<void> {
  const { beekeeper_id, harvest_draft } = sessionData;
  if (!beekeeper_id || !harvest_draft) {
    await whatsapp.sendText(waId, t(lang, 'error_generic'));
    return;
  }

  try {
    // Call the batch creation API route internally
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ADMIN_API_KEY ? { 'x-admin-api-key': process.env.ADMIN_API_KEY } : {}),
      },
      body: JSON.stringify({
        beekeeperId: beekeeper_id,
        honeyType: harvest_draft.honeyType,
        quantityGrams: harvest_draft.quantityGrams,
        hivesHarvested: harvest_draft.hivesHarvested ?? 1,
        harvestDate: new Date().toISOString(),
        region: sessionData.registration?.region ?? 'India',
      }),
    });

    if (!response.ok) {
      throw new Error(`Batch API returned ${response.status}`);
    }

    const result = await response.json() as { batchCode: string; txHash: string };
    const successText = t(lang, 'harvest_success', result.batchCode, result.txHash);

    await whatsapp.sendText(waId, successText);
    await fsm.setSession(waId, ConversationState.MAIN_MENU, {
      ...sessionData,
      harvest_draft: undefined,
    });
    await sendMainMenu(waId, lang);
  } catch (err) {
    console.error('[handler] createHarvestBatch failed:', err);
    await whatsapp.sendText(waId, t(lang, 'error_generic'));
  }
}
