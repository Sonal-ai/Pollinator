import { whatsAppProcessing } from './processing-context';
import { serverAppOrigin } from '../app-origin';
import { normalizePhone, phoneLookupVariants } from '../identity';
import { createHash, randomUUID } from 'crypto';
import { parseHarvestQuantity } from './harvest-quantity';
import { prisma } from '../db';
import {
  ConversationState,
  SessionData,
  fsm,
  type Session,
} from './fsm';
import {
  analyzeIncomingText,
  analyzeIncomingAudio,
  generateBeekeepingAdvice,
  generateOnboardingResponse,
  type SupportedLanguage,
  type MessageIntent,
} from './gemini';
import { whatsapp } from './client';
import { getExplorerTxUrl } from '../blockchain';
import { detectVarroaFromBuffer } from '../varroa-detector';

function database() { return whatsAppProcessing.getStore()?.db ?? prisma; }
function sessions() { return whatsAppProcessing.getStore()?.sessions ?? fsm; }
function messenger() { return whatsAppProcessing.getStore()?.messenger ?? whatsapp; }

async function findBeekeeperForPhone(waId: string) {
  const matches = await database().beekeeper.findMany({
    where: { phone: { in: phoneLookupVariants(waId) } },
    include: { hives: { take: 1 } }, take: 2,
  });
  // Ambiguous legacy records require operator reconciliation.
  return matches.length === 1 ? matches[0] : null;
}

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
  image?: { id: string; mime_type?: string };
  audio?: { id: string; mime_type?: string };
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

type StringValue = string | ((...args: unknown[]) => string);
const STRINGS: Record<SupportedLanguage, Record<string, StringValue>> = {
  en: {
    welcome_onboarding: '👋 Welcome to *HoneyChain* & *Pollinator*!\n\nWe connect beekeepers directly to fair markets and IoT hive monitoring on the Polygon blockchain.\n\nHow can I help you today?',
    welcome_back:       '🐝 Welcome back! How can I help you today?',
    ask_name:           'What is your name?',
    ask_region:         'Which state or district are you from? (e.g. Wardha, Maharashtra)',
    ask_hive_count:     'How many hives do you have?',
    ask_practices:      'What type of beekeeping do you practice? (e.g. Apis cerana, Apis mellifera)',
    registration_done:  '✅ You\'re registered! Here\'s your main menu:',
    harvest_type:       '🍯 What type of honey is this harvest? (e.g. Mustard, Litchi, Multiflora)',
    harvest_quantity:   '⚖️ How many grams of honey did you harvest? (Enter a number in grams, e.g. 5000 for 5kg)',
    harvest_confirm:    ((type: string, grams: number) =>
                          `Confirm harvest:\n🍯 Type: ${type}\n⚖️ Quantity: ${(grams / 1000).toFixed(2)} kg\n\nIs this correct?`) as StringValue,
    harvest_success:    ((code: string, tx: string) => {
      const explorerUrl = getExplorerTxUrl(tx);
      const linkText = explorerUrl ? `View on Polygonscan: ${explorerUrl}` : `Local Hardhat TX: ${tx.slice(0, 14)}...`;
      return `✅ *Harvest registered on blockchain!*\n\nBatch Code: \`${code}\`\n${linkText}`;
    }) as StringValue,
    harvest_cancel:     '❌ Harvest cancelled. Returning to main menu.',
    market_info: 'No live honey-price or subsidy-eligibility feed is configured. Ask your cooperative for a dated buyer quote and confirm current scheme terms with KVIC/NBB. This prototype does not promise a price, market access, subsidy percentage or approval.',
    bee_health_info: 'Hive readings and image screens are inspection aids. They cannot establish colony health, diagnose Varroa infestation, or prescribe a treatment. Ask a trained beekeeper to inspect. A photo may miss hidden mites.',
    ask_question:       '❓ Please type or speak your beekeeping question (voice notes welcome!):',
    hive_no_data:       '📡 No sensor data found for your hives yet. Tap "Pair IoT Hive" to link your ESP32 sensor box!',
    error_generic:      '⚠️ Something went wrong. Please try again.',
    invalid_number:     '⚠️ Please enter a valid number.',
    btn_hive_status:    '🌡️ Hive IoT Status',
    btn_bee_health:     '🐝 Bee Health Care',
    btn_harvest:        '🍯 Log Harvest',
    btn_market:         '💰 Market & Schemes',
    btn_ask:            '❓ Ask a Question',
    btn_yes:            '✅ Yes',
    btn_no:             '❌ No',
    btn_register_hive:  '📲 Pair IoT Hive',
    ask_device_id:      'Please type the Device ID printed on your Hive Sensor (e.g. ESP32-001):',
    hive_registered:    '✅ Hive paired successfully! You will now receive sensor updates.',
    btn_onboard_register: 'Register Now',
    btn_onboard_info:   'About Platform',
    btn_onboard_doubt:  'Ask a Question',
    btn_back_menu:      'Main Menu',
  },
  hi: {
    welcome_onboarding: '👋 *HoneyChain* और *Pollinator* में आपका स्वागत है!\n\nहम मधुमक्खी पालकों को पॉलीगॉन ब्लॉकचेन के माध्यम से सीधे बाज़ार और IoT छत्ता निगरानी से जोड़ते हैं।\n\nआज मैं आपकी कैसे सहायता कर सकता हूँ?',
    welcome_back:       '🐝 वापस स्वागत है! आज मैं आपकी कैसे मदद कर सकता हूँ?',
    ask_name:           'आपका पूरा नाम क्या है?',
    ask_region:         'आप किस राज्य या ज़िले से हैं? (जैसे वर्धा, महाराष्ट्र)',
    ask_hive_count:     'आपके पास कितने मधुमक्खी के छत्ते (boxes) हैं?',
    ask_practices:      'आप किस प्रकार की मधुमक्खी पालन करते हैं? (जैसे Apis cerana, Apis mellifera)',
    registration_done:  '✅ आपका पंजीकरण पूरा हो गया! यहाँ आपका मुख्य मेनू है:',
    harvest_type:       '🍯 यह फसल किस प्रकार का शहद है? (जैसे सरसों, लीची, मल्टीफ्लोरा)',
    harvest_quantity:   '⚖️ आपने कितने ग्राम शहद निकाला? (ग्राम में संख्या लिखें, उदा. 5000)',
    harvest_confirm:    ((type: string, grams: number) =>
                          `फसल की पुष्टि करें:\n🍯 प्रकार: ${type}\n⚖️ मात्रा: ${(grams / 1000).toFixed(2)} किग्रा\n\nक्या यह सही है?`) as StringValue,
    harvest_success:    ((code: string, tx: string) => {
      const explorerUrl = getExplorerTxUrl(tx);
      const linkText = explorerUrl ? `Polygonscan पर देखें: ${explorerUrl}` : `ब्लॉकचेन TX: ${tx.slice(0, 14)}...`;
      return `✅ *फसल ब्लॉकचेन पर दर्ज हो गई!*\n\nबैच कोड: \`${code}\`\n${linkText}`;
    }) as StringValue,
    harvest_cancel:     '❌ फसल रद्द। मुख्य मेनू पर वापस।',
    market_info: 'No live honey-price or subsidy-eligibility feed is configured. Ask your cooperative for a dated buyer quote and confirm current scheme terms with KVIC/NBB. This prototype does not promise a price, market access, subsidy percentage or approval.',
    bee_health_info: 'Hive readings and image screens are inspection aids. They cannot establish colony health, diagnose Varroa infestation, or prescribe a treatment. Ask a trained beekeeper to inspect. A photo may miss hidden mites.',
    ask_question:       '❓ कृपया अपना प्रश्न लिखें या बोलकर भेजें (वॉइस नोट भी भेज सकते हैं):',
    hive_no_data:       '📡 आपके छत्तों का कोई सेंसर डेटा नहीं मिला। कृपया "IoT छत्ता जोड़ें" विकल्प चुनें।',
    error_generic:      '⚠️ कुछ गड़बड़ हुई। कृपया पुनः प्रयास करें।',
    invalid_number:     '⚠️ कृपया एक वैध संख्या दर्ज करें।',
    btn_hive_status:    '🌡️ छत्ते की स्थिति',
    btn_bee_health:     '🐝 मधुमक्खी स्वास्थ्य',
    btn_harvest:        '🍯 फसल दर्ज करें',
    btn_market:         '💰 बाज़ार व योजनाएं',
    btn_ask:            '❓ प्रश्न पूछें',
    btn_yes:            '✅ हाँ',
    btn_no:             '❌ नहीं',
    btn_register_hive:  '📲 IoT छत्ता जोड़ें',
    ask_device_id:      'कृपया अपने छत्ता सेंसर पर मुद्रित डिवाइस आईडी टाइप करें (जैसे ESP32-001):',
    hive_registered:    '✅ छत्ता सफलतापूर्वक जुड़ गया! अब आपको सेंसर अपडेट मिलेंगे।',
    btn_onboard_register: 'अभी पंजीकरण करें',
    btn_onboard_info:   'प्लेटफ़ॉर्म के बारे में',
    btn_onboard_doubt:  'प्रश्न पूछें',
    btn_back_menu:      'मुख्य मेनू',
  },
  te: {} as Record<string, string>,
  bn: {} as Record<string, string>,
  mr: {} as Record<string, string>,
  ta: {} as Record<string, string>,
};

function t(lang: SupportedLanguage, key: string, ...args: unknown[]): string {
  const str = STRINGS.en[key] ?? key;
  if (typeof str === 'function') {
    return (str as (...a: unknown[]) => string)(...args);
  }
  return str;
}

// ============================================================
// AI Image Analysis (AWS Lambda Varroa Detector)
// ============================================================

async function handleIncomingImage(
  waId: string,
  imageId: string,
  lang: SupportedLanguage
): Promise<void> {
  const beekeeper = await findBeekeeperForPhone(waId);
  if (!beekeeper) {
    await messenger().sendText(waId, 'Please register your own beekeeper account before sending a health image.', lang);
    return;
  }

  const waitMsg = '🔍 *Analyzing your bee frame photo for Varroa mites...*\nRequesting the configured image-screening endpoint. Results may be uncertain or unavailable.';
  
  await messenger().sendText(waId, waitMsg, lang);

  try {
    const imageBuffer = await messenger().downloadMedia(imageId, 4 * 1024 * 1024);
    const result = await detectVarroaFromBuffer(imageBuffer);
    const imageHash = createHash('sha256').update(imageBuffer).digest('hex');

    await database().aIInference.create({
      data: { beekeeperId: beekeeper.id, hiveId: null, modelVersion: result.modelVersion,
        inputImageHash: imageHash, prediction: result.prediction, confidence: result.confidence, rawOutput: JSON.stringify(result) },
    });
    const responseText = 'Image screen: ' + result.prediction.replaceAll('_', ' ') + '\n'
      + 'Visible candidates: ' + result.summary.bee_count + ' bees, ' + result.summary.mite_count + ' possible mites.\n\n'
      + result.alert.message + '\n\nNo colony infestation percentage or treatment recommendation can be inferred from this photograph.';

    await messenger().sendText(waId, responseText, lang);
  } catch {
    console.error('[handler-image] Image screening unavailable; no health conclusion was recorded.');
    const failMsg = '⚠️ Sorry, image screening is unavailable or the image is unsuitable. No health conclusion was recorded. Please use an in-person inspection if concerned.';
    await messenger().sendText(waId, failMsg, lang);
  }
}

// ============================================================
// Main Entry Point
// ============================================================

export async function handleIncomingMessage(body: MetaWebhookBody): Promise<void> {
  for (const entry of body.entry ?? []) for (const change of entry.changes ?? []) {
    for (const message of change.value?.messages ?? []) await handleMessage(message);
  }
}

async function handleMessage(message: MetaMessage): Promise<void> {

  const waId = message.from;
  const msgId = message.id;

  // Deduplication — Meta sometimes delivers the same webhook twice
  if (await sessions().isDuplicateMessage(msgId)) return;

  // Mark as read immediately
  if (!whatsAppProcessing.getStore()) void messenger().markAsRead(msgId).catch(() => {});

  const session = await sessions().getSession(waId);
  let lang = (session.data.language as SupportedLanguage) || 'en';

  // Handle incoming photo/image message (AI Varroa Detector on AWS Lambda)
  if (message.type === 'image' && message.image?.id) {
    console.log('[handler] Processing an incoming image.');
    await handleIncomingImage(waId, message.image.id, lang);
    return;
  }

  // 1. Process text or audio content
  let incomingText = extractText(message);
  let detectedLang: SupportedLanguage = lang;
  let intent: MessageIntent = 'UNKNOWN';

  if (message.type === 'audio' && message.audio?.id) {
    try {
      console.log('[handler] Processing incoming audio.');
      const audioBuffer = await messenger().downloadMedia(message.audio.id);
      const audioAnalysis = await analyzeIncomingAudio(audioBuffer, message.audio.mime_type || 'audio/ogg');
      incomingText = audioAnalysis.translated_english_text;
      detectedLang = audioAnalysis.detected_language;
      intent = audioAnalysis.intent;
    } catch {
      console.error('[handler-audio] Audio processing unavailable.');
      await messenger().sendText(waId, '⚠️ Sorry, could not process voice note. Please try sending text.', lang);
      return;
    }
  } else if (message.type === 'text' && incomingText.trim() &&
      [ConversationState.IDLE, ConversationState.ONBOARDING, ConversationState.MAIN_MENU].includes(session.state)) {
    const textAnalysis = await analyzeIncomingText(incomingText);
    detectedLang = textAnalysis.detected_language;
    intent = textAnalysis.intent;
    if (textAnalysis.requested_language_code) {
      const req = textAnalysis.requested_language_code.toLowerCase().slice(0, 2) as SupportedLanguage;
      if (['en', 'hi', 'te', 'bn', 'mr', 'ta'].includes(req)) {
        detectedLang = req;
      }
    }
  }

  // Update language in session if detected
  if (detectedLang && detectedLang !== lang) {
    lang = detectedLang;
    await sessions().updateSessionData(waId, { language: lang });
  }

  try {
    await route(waId, message, session, lang, incomingText, intent);
  } catch (err) {
    if (whatsAppProcessing.getStore()) throw err;
    console.error('[handler] Message routing unavailable.');
    await messenger().sendText(waId, t(lang, 'error_generic'), lang);
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
  text: string,
  intent: MessageIntent
): Promise<void> {
  const state = session.state;
  const buttonId = getButtonId(message);
  const normalizedText = text.trim().toLowerCase();

  const beekeeper = await findBeekeeperForPhone(waId);
  session = { ...session, data: { ...session.data, beekeeper_id: beekeeper?.id } };

  // ----------------------------------------------------------
  // Global Language Switch Intercept
  // ----------------------------------------------------------
  if (intent === 'CHANGE_LANGUAGE' || normalizedText.includes('language') || normalizedText.includes('bhasha')) {
    const langNames: Record<string, string> = {
      en: 'English',
      hi: 'हिंदी (Hindi)',
      te: 'తెలుగు (Telugu)',
      bn: 'বাংলা (Bengali)',
      mr: 'मराठी (Marathi)',
      ta: 'தமிழ் (Tamil)',
    };
    await messenger().sendText(
      waId,
      `✅ Language set to ${langNames[lang] || lang}!\n\nReturning to menu...`
    , lang);
    if (beekeeper) {
      await sendMainMenu(waId, lang, beekeeper.name);
    } else {
      await sendOnboardingMenu(waId, lang);
    }
    return;
  }

  // ----------------------------------------------------------
  // Global Back to Menu / Cancel / Greetings
  // ----------------------------------------------------------
  if (
    buttonId === 'btn_back_menu' ||
    buttonId === 'btn_menu' ||
    normalizedText === 'menu' ||
    normalizedText === 'cancel' ||
    normalizedText === 'start' ||
    normalizedText === 'hi' ||
    normalizedText === 'hello' ||
    normalizedText === 'namaste' ||
    (state === ConversationState.IDLE && beekeeper)
  ) {
    if (beekeeper) {
      await sessions().setSession(waId, ConversationState.MAIN_MENU, {
        beekeeper_id: beekeeper.id,
        language: lang,
      });
      await sendMainMenu(waId, lang, beekeeper.name);
    } else {
      await sendOnboardingMenu(waId, lang);
    }
    return;
  }

  // ==========================================================
  // UNREGISTERED USER FLOW (Frictionless Onboarding)
  // ==========================================================
  if (!beekeeper) {
    // If user explicitly triggers registration
    if (
      buttonId === 'onboard_register' ||
      intent === 'REGISTRATION' ||
      normalizedText === 'register' ||
      normalizedText.includes('register karna') ||
      normalizedText.includes('sign up')
    ) {
      await sessions().setSession(waId, ConversationState.REGISTRATION_NAME, { language: lang });
      await messenger().sendText(waId, `🐝 *Pollinator Registration (Step 1/4)*\n\n${t(lang, 'ask_name')}`, lang);
      return;
    }

    // If user tapped "About Platform"
    if (buttonId === 'onboard_info' || normalizedText === 'about' || normalizedText.includes('about app')) {
      const infoText =
        '🌟 *About Pollinator & HoneyChain*\n\n' +
        'Pollinator is a decentralized platform built on the Polygon blockchain to empower Indian beekeepers:\n\n' +
        '1. 🍯 *Fair Prices*: Cut out middlemen and connect directly to verified buyers.\n' +
        '2. 🌡️ *Smart IoT Hives*: Monitor temperature, humidity, and weight in real-time.\n' +
        '3. ⛓️ *Blockchain Traceability*: Mint tamper-proof QR codes for your honey batches.\n' +
        '4. 🏛️ *Govt Schemes*: Guidance for KVIC National Honey Mission subsidies.\n\n' +
        'Ready to get started?';

      
      await messenger().sendButtons(waId, infoText, [
        { type: 'reply', reply: { id: 'onboard_register', title: t(lang, 'btn_onboard_register') } },
        { type: 'reply', reply: { id: 'onboard_doubt', title: t(lang, 'btn_onboard_doubt') } },
      ], lang);
      return;
    }

    // If user tapped "Ask a Question"
    if (buttonId === 'onboard_doubt') {
      await sessions().setSession(waId, ConversationState.ASK_QUESTION, { language: lang });
      await messenger().sendText(waId, t(lang, 'ask_question'), lang);
      return;
    }

    // Handle ongoing registration steps for unregistered users
    if (state === ConversationState.REGISTRATION_NAME) {
      if (!text.trim() || text.trim().length > 100) {
        await messenger().sendText(waId, t(lang, 'ask_name'), lang);
        return;
      }
      await sessions().setSession(waId, ConversationState.REGISTRATION_REGION, {
        language: lang,
        registration: { name: text.trim() },
      });
      await messenger().sendText(waId, `*Step 2/4:* ${t(lang, 'ask_region')}`, lang);
      return;
    }

    if (state === ConversationState.REGISTRATION_REGION) {
      if (!text.trim() || text.trim().length > 150) {
        await messenger().sendText(waId, t(lang, 'ask_region'), lang); return;
      }
      await sessions().setSession(waId, ConversationState.REGISTRATION_HIVE_COUNT, {
        ...session.data,
        registration: { ...session.data.registration, region: text.trim() },
      });
      await messenger().sendText(waId, `*Step 3/4:* ${t(lang, 'ask_hive_count')}`, lang);
      return;
    }

    if (state === ConversationState.REGISTRATION_HIVE_COUNT) {
      const count = Number(text.trim());
      if (!/^[1-9]\d{0,5}$/.test(text.trim()) || count > 100000) {
        await messenger().sendText(waId, t(lang, 'invalid_number'), lang);
        return;
      }
      await sessions().setSession(waId, ConversationState.REGISTRATION_PRACTICES, {
        ...session.data,
        registration: { ...session.data.registration, hivesCount: count },
      });
      await messenger().sendText(waId, `*Step 4/4:* ${t(lang, 'ask_practices')}`, lang);
      return;
    }

    if (state === ConversationState.REGISTRATION_PRACTICES) {
      if (!text.trim() || text.trim().length > 150) {
        await messenger().sendText(waId, t(lang, 'ask_practices'), lang); return;
      }
      const reg = session.data.registration ?? {};

      const newBeekeeper = await database().beekeeper.create({
        data: {
          phone: normalizePhone(waId)!,
          name: reg.name ?? 'Unknown',
          region: reg.region ?? '',
          hivesCount: reg.hivesCount ?? 0,
          practices: text.trim(),
          wallet: null,
        },
      });

      await sessions().setSession(waId, ConversationState.MAIN_MENU, {
        language: lang,
        beekeeper_id: newBeekeeper.id,
      });

      await messenger().sendText(
        waId,
        `${t(lang, 'registration_done')}\n\n${lang === 'hi' ? 'ब्लॉकचेन स्वीकृति के लिए सहकारी संचालक से अपना खाता जोड़ने को कहें। अभी कोई ब्लॉकचेन वॉलेट पंजीकृत नहीं हुआ है।' : 'Ask your cooperative operator to link your approved signing account. A blockchain wallet has not been enrolled by this chat registration.'}`
      , lang);
      await sendMainMenu(waId, lang);
      return;
    }

    // In ASK_QUESTION state for unregistered user
    if (state === ConversationState.ASK_QUESTION) {
      const advice = await generateBeekeepingAdvice(text);
      
      await messenger().sendText(waId, `🐝 *Pollinator AI:*\n\n${advice}`, lang);
      await sendOnboardingMenu(waId, lang);
      return;
    }

    // If unregistered user asks a question or says hi/hello
    const onboardingRes = await generateOnboardingResponse(text, lang);
    

    if (onboardingRes.ready_to_register) {
      await sessions().setSession(waId, ConversationState.REGISTRATION_NAME, { language: lang });
      await messenger().sendText(waId, `${onboardingRes.response}\n\n*Step 1/4:* ${t(lang, 'ask_name')}`, lang);
      return;
    }

    await messenger().sendButtons(waId, onboardingRes.response, [
      { type: 'reply', reply: { id: 'onboard_register', title: t(lang, 'btn_onboard_register') } },
      { type: 'reply', reply: { id: 'onboard_info', title: t(lang, 'btn_onboard_info') } },
      { type: 'reply', reply: { id: 'onboard_doubt', title: t(lang, 'btn_onboard_doubt') } },
    ], lang);
    await sessions().setSession(waId, ConversationState.ONBOARDING, { language: lang });
    return;
  }

  // ==========================================================
  // REGISTERED USER FLOW
  // ==========================================================

  // 1. REGISTER HIVE (IoT Pairing)
  if (state === ConversationState.REGISTER_HIVE) {
    const deviceId = text.trim().toUpperCase();
    const existing = await database().hive.findUnique({ where: { deviceId } });
    if (existing && existing.beekeeperId !== beekeeper.id) {
      await messenger().sendText(waId, 'This device belongs to another beekeeper. Contact an administrator to transfer it.', lang);
      return;
    }
    if (!existing) {
      await messenger().sendText(waId, 'This device is not enrolled. Your cooperative must verify its physical label and ownership and install a private credential. A typed ID alone cannot pair a device.', lang);
      return;
    }

    await messenger().sendText(waId, `✅ Hive [${deviceId}] is assigned to your farm.\n\nOnly signed packets from its enrolled credential are accepted.`, lang);
    await sessions().setSession(waId, ConversationState.MAIN_MENU, { ...session.data, beekeeper_id: beekeeper.id });
    await sendMainMenu(waId, lang);
    return;
  }

  // 2. HARVEST FLOW
  if (state === ConversationState.HARVEST_TYPE) {
    if (!text.trim() || text.trim().length > 100) {
      await messenger().sendText(waId, t(lang, 'harvest_type'), lang); return;
    }
    await sessions().setSession(waId, ConversationState.HARVEST_QUANTITY, {
      ...session.data,
      beekeeper_id: beekeeper.id,
      harvest_draft: { honeyType: text.trim(), requestKey: randomUUID(), harvestDate: new Date().toISOString() },
    });
    await messenger().sendText(waId, t(lang, 'harvest_quantity'), lang);
    return;
  }

  if (state === ConversationState.HARVEST_QUANTITY) {
    const grams = parseHarvestQuantity(text);
    if (grams === null) {
      await messenger().sendText(waId, t(lang, 'invalid_number'), lang);
      return;
    }

    const draft = session.data.harvest_draft ?? {};
    const honeyType = draft.honeyType ?? 'Multiflora';
    const confirmText = t(lang, 'harvest_confirm', honeyType, grams);

    await sessions().setSession(waId, ConversationState.HARVEST_CONFIRM, {
      ...session.data,
      harvest_draft: { ...draft, quantityGrams: grams },
    });

    await messenger().sendButtons(waId, confirmText, [
      { type: 'reply', reply: { id: 'harvest_yes', title: t(lang, 'btn_yes') } },
      { type: 'reply', reply: { id: 'harvest_no', title: t(lang, 'btn_no') } },
    ], lang);
    return;
  }

  if (state === ConversationState.HARVEST_CONFIRM) {
    if (buttonId === 'harvest_yes' || ['yes', 'y', 'confirm', 'haan', 'हाँ'].includes(normalizedText)) {
      await createHarvestBatch(waId, session.data, lang);
    } else if (buttonId === 'harvest_no' || ['no', 'n', 'नहीं'].includes(normalizedText)) {
      await sessions().setSession(waId, ConversationState.MAIN_MENU, session.data);
      await messenger().sendText(waId, t(lang, 'harvest_cancel'), lang);
      await sendMainMenu(waId, lang);
    } else {
      await messenger().sendButtons(waId, t(lang, 'harvest_confirm', session.data.harvest_draft?.honeyType ?? '', session.data.harvest_draft?.quantityGrams ?? 0), [
        { type: 'reply', reply: { id: 'harvest_yes', title: t(lang, 'btn_yes') } },
        { type: 'reply', reply: { id: 'harvest_no', title: t(lang, 'btn_no') } },
      ], lang);
    }
    return;
  }


  if (
    buttonId === 'menu_harvest' ||
    normalizedText === 'harvest' ||
    normalizedText.includes('shahad harvest') ||
    normalizedText.includes('log harvest')
  ) {
    await sessions().setSession(waId, ConversationState.HARVEST_TYPE, {
      ...session.data,
      beekeeper_id: beekeeper.id,
    });
    await messenger().sendText(waId, t(lang, 'harvest_type'), lang);
    return;
  }

  // Global Intent Shortcuts for Registered User (available from anywhere!)
  if (
    intent === 'HIVE_STATUS' ||
    buttonId === 'menu_hive_status' ||
    normalizedText.includes('hive status') ||
    normalizedText.includes('temperature') ||
    normalizedText.includes('humidity') ||
    normalizedText.includes('box status')
  ) {
    await handleHiveStatus(waId, lang);
    return;
  }

  if (
    intent === 'HARVEST_MARKET' ||
    buttonId === 'menu_market' ||
    normalizedText.includes('market') ||
    normalizedText.includes('rate') ||
    normalizedText.includes('price') ||
    normalizedText.includes('bhav') ||
    normalizedText.includes('subsidy') ||
    normalizedText.includes('kvic')
  ) {
    await messenger().sendButtons(waId, t(lang, 'market_info'), [
      { type: 'reply', reply: { id: 'menu_harvest', title: t(lang, 'btn_harvest') } },
      { type: 'reply', reply: { id: 'btn_back_menu', title: t(lang, 'btn_back_menu') } },
    ], lang);
    return;
  }

  if (
    intent === 'HEALTH_CHECK' ||
    buttonId === 'menu_bee_health' ||
    normalizedText.includes('health') ||
    normalizedText.includes('disease') ||
    normalizedText.includes('queen') ||
    normalizedText.includes('bimari')
  ) {
    await messenger().sendButtons(waId, t(lang, 'bee_health_info'), [
      { type: 'reply', reply: { id: 'menu_ask', title: t(lang, 'btn_ask') } },
      { type: 'reply', reply: { id: 'btn_back_menu', title: t(lang, 'btn_back_menu') } },
    ], lang);
    return;
  }

  if (buttonId === 'menu_register_hive' || normalizedText.includes('pair hive') || normalizedText.includes('add hive')) {
    await sessions().setSession(waId, ConversationState.REGISTER_HIVE, {
      ...session.data,
      beekeeper_id: beekeeper.id,
    });
    await messenger().sendText(waId, t(lang, 'ask_device_id'), lang);
    return;
  }

  if (buttonId === 'menu_ask') {
    await sessions().setSession(waId, ConversationState.ASK_QUESTION, {
      ...session.data,
      beekeeper_id: beekeeper.id,
    });
    await messenger().sendText(waId, t(lang, 'ask_question'), lang);
    return;
  }

  // ----------------------------------------------------------
  // Registered User FSM States
  // ----------------------------------------------------------

  // 3. ASK A QUESTION
  if (state === ConversationState.ASK_QUESTION || intent === 'ASK_DOUBT' || text.includes('?')) {
    const advice = await generateBeekeepingAdvice(text);
    
    await messenger().sendText(waId, `🐝 *Pollinator AI:*\n\n${advice}`, lang);
    await sessions().setSession(waId, ConversationState.MAIN_MENU, { ...session.data, beekeeper_id: beekeeper.id });
    await sendMainMenu(waId, lang);
    return;
  }

  // Default Fallback for registered user
  await sessions().setSession(waId, ConversationState.MAIN_MENU, {
    beekeeper_id: beekeeper.id,
    language: lang,
  });
  await sendMainMenu(waId, lang);
}

// ============================================================
// UI Menus & Helpers
// ============================================================

async function sendOnboardingMenu(waId: string, lang: SupportedLanguage): Promise<void> {
  const buttons = [
    { type: 'reply' as const, reply: { id: 'onboard_register', title: t(lang, 'btn_onboard_register') } },
    { type: 'reply' as const, reply: { id: 'onboard_info', title: t(lang, 'btn_onboard_info') } },
    { type: 'reply' as const, reply: { id: 'onboard_doubt', title: t(lang, 'btn_onboard_doubt') } },
  ];
  await messenger().sendButtons(waId, t(lang, 'welcome_onboarding'), buttons, lang);
}

async function sendMainMenu(waId: string, lang: SupportedLanguage, beekeeperName?: string | null): Promise<void> {
  const greeting = beekeeperName
    ? `🐝 Namaste ${beekeeperName}! Welcome back to Pollinator.`
    : t(lang, 'welcome_back');

  await messenger().sendList(
    waId,
    '🐝 Pollinator',
    greeting,
    'Open Menu',
    [
      {
        title: 'Farm & IoT',
        rows: [
          { id: 'menu_hive_status', title: t(lang, 'btn_hive_status'), description: 'Live sensor data & AI health score from your smart hives' },
          { id: 'menu_register_hive', title: t(lang, 'btn_register_hive'), description: 'Pair an ESP32 IoT sensor box' },
          { id: 'menu_bee_health', title: t(lang, 'btn_bee_health'), description: 'Check diseases & hive condition' },
          { id: 'menu_harvest', title: t(lang, 'btn_harvest'), description: 'Register harvest batch on Polygon' },
        ],
      },
      {
        title: 'Market & AI Advice',
        rows: [
          { id: 'menu_market', title: t(lang, 'btn_market'), description: 'Honey farmgate rates & KVIC subsidies' },
          { id: 'menu_ask', title: t(lang, 'btn_ask'), description: 'Ask any question via text or voice' },
        ],
      },
    ]
  , lang);
}

async function handleHiveStatus(
  waId: string,
  lang: SupportedLanguage
): Promise<void> {
  const beekeeper = await findBeekeeperForPhone(waId);
  const beekeeperIds = beekeeper ? [beekeeper.id] : [];

  const hives = await database().hive.findMany({
    where: { beekeeperId: { in: beekeeperIds } },
    include: {
      readings: {
        orderBy: { timestamp: 'desc' },
        take: 2,
      },
    },
    orderBy: { deviceId: 'asc' },
  });

  if (hives.length === 0) {
    // Never show another user's hives or manufactured health readings.
    const statusMessage = 'No hives are assigned to your verified phone number. Contact your cooperative to enroll a device.';

    await messenger().sendButtons(waId, statusMessage, [
      { type: 'reply', reply: { id: 'menu_register_hive', title: t(lang, 'btn_register_hive') } },
      { type: 'reply', reply: { id: 'btn_back_menu', title: t(lang, 'btn_back_menu') } },
    ], lang);
    return;
  }

  const { calculateHiveHealth } = await import('../iot-health-model');
  let statusText = '🌡️ *Stored Hive Readings*\nRules are inspection prompts, not a disease diagnosis.\n\n';

  for (const hive of hives) {
    const reading = hive.readings[0];
    const prevReading = hive.readings[1];
    statusText += `📦 *Hive ${hive.deviceId}* (${hive.region || 'Active'})\n`;
    if (reading) {
      const health = calculateHiveHealth({
        tempC: reading.tempC,
        humidityPct: reading.humidityPct,
        weightKg: reading.weightKg,
        batteryPct: reading.batteryPct,
        previousWeightKg: prevReading?.source === reading.source ? prevReading.weightKg : null,
        timestamp: reading.timestamp, previousTimestamp: prevReading?.timestamp, source: reading.source,
      });

      statusText += `• Temperature: ${reading.tempC?.toFixed(1) ?? 'Unavailable'}°C (${health.metrics.tempStatus})\n`;
      statusText += `• Humidity: ${reading.humidityPct?.toFixed(1) ?? 'Unavailable'}% (${health.metrics.humidityStatus})\n`;
      statusText += `• Hive Weight: *${reading.weightKg?.toFixed(2) ?? 'Unavailable'} kg* (${health.metrics.weightDeltaKg != null && health.metrics.weightDeltaKg >= 0 ? '+' : ''}${health.metrics.weightDeltaKg ?? 'Unavailable'} kg delta)\n`;
      statusText += `• Source: *${reading.source}*\n• Reading time: ${reading.timestamp.toISOString()}\n• Rules index: *${health.score ?? 'Unavailable'}/100* [${health.status.replace('_', ' ')}]\n`;
      statusText += `• Battery: ${reading.batteryPct?.toFixed(0) ?? 'Unavailable'}% 🔋\n`;
      if (health.insights.length > 0) {
        statusText += `💡 *Inspection prompt*: ${health.insights[0]}\n`;
      }
      if (health.recommendations.length > 0) {
        statusText += `⚡ *Action*: ${health.recommendations[0]}\n`;
      }
      statusText += `\n`;
    } else {
      statusText += `• Status: Paired, awaiting first sensor reading...\n\n`;
    }
  }

  
  await messenger().sendButtons(waId, statusText, [
    { type: 'reply', reply: { id: 'btn_back_menu', title: t(lang, 'btn_back_menu') } },
  ], lang);
}

async function createHarvestBatch(
  waId: string,
  sessionData: SessionData,
  lang: SupportedLanguage
): Promise<void> {
  const { harvest_draft } = sessionData;
  const beekeeper = await findBeekeeperForPhone(waId);
  const beekeeper_id = beekeeper?.id;
  if (!beekeeper_id || !harvest_draft) {
    await messenger().sendText(waId, t(lang, 'error_generic'), lang);
    return;
  }
  if (!beekeeper.wallet) {
    await messenger().sendText(waId, lang === 'hi' ? 'आपका फसल मसौदा अभी बातचीत में सुरक्षित है। ब्लॉकचेन पर भेजने से पहले सहकारी संचालक से अपना स्वीकृत खाता जोड़ने को कहें।' : 'Your harvest draft remains in this conversation. Ask the cooperative operator to enroll your signing account before blockchain registration.', lang);
    return;
  }
  if (!harvest_draft.requestKey || !harvest_draft.harvestDate || !harvest_draft.quantityGrams || !harvest_draft.honeyType) {
    await messenger().sendText(waId, lang === 'hi' ? 'कृपया नया फसल मसौदा शुरू करें और मात्रा फिर से पुष्टि करें।' : 'Please start a new harvest draft and confirm its quantity again.', lang);
    return;
  }

  try {
    const appUrl = serverAppOrigin();
    const response = await fetch(`${appUrl}/api/batch`, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': harvest_draft.requestKey,
        ...(process.env.ADMIN_API_KEY ? { 'x-admin-api-key': process.env.ADMIN_API_KEY } : {}),
      },
      body: JSON.stringify({
        beekeeperId: beekeeper_id,
        honeyType: harvest_draft.honeyType,
        quantityGrams: harvest_draft.quantityGrams,
        hivesHarvested: harvest_draft.hivesHarvested ?? 1,
        harvestDate: harvest_draft.harvestDate,
        region: beekeeper.region ?? sessionData.registration?.region ?? '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Batch API returned ${response.status}`);
    }

    const result = (await response.json()) as { batchCode: string; operationId?: string };
    if (!result.operationId) throw new Error('No stored operation was returned');
    const approvalUrl = `${appUrl}/dashboard/operations/${encodeURIComponent(result.operationId)}`;
    const successText = lang === 'hi' ? `फसल का अनुरोध सुरक्षित है। ब्लॉकचेन पुष्टि अभी बाकी है।\nबैच: ${result.batchCode}\nअपने स्वीकृत खाते से जाँचें और अनुमति दें: ${approvalUrl}` : `Harvest request saved. Blockchain confirmation is pending.\nBatch: ${result.batchCode}\nReview and approve from your enrolled account: ${approvalUrl}`;

    // This text is already localized. Never let a model rewrite an approval URL or batch identifier.
    await messenger().sendText(waId, successText, 'en');
    await sessions().setSession(waId, ConversationState.MAIN_MENU, {
      ...sessionData,
      harvest_draft: undefined,
    });
    await sendMainMenu(waId, lang);
  } catch (err) {
    if (whatsAppProcessing.getStore()) throw err;
    console.error('[handler] Harvest preparation unavailable.');
    await messenger().sendText(waId, t(lang, 'error_generic'), lang);
  }
}

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
