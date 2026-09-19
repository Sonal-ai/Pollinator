import { env } from '../env';

// ============================================================
// Bedrock Client Setup
// ============================================================

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return bedrockClient;
}

// ============================================================
// Types
// ============================================================

export type SupportedLanguage = 'en' | 'hi' | 'te' | 'bn' | 'mr' | 'ta';

export type MessageIntent =
  | 'MAIN_MENU'
  | 'REGISTRATION'
  | 'ASK_DOUBT'
  | 'HEALTH_CHECK'
  | 'HARVEST_MARKET'
  | 'TRANSFER'
  | 'UNKNOWN';

export interface TextAnalysisResult {
  detected_language: SupportedLanguage;
  translated_english_text: string;
  intent: MessageIntent;
}

// ============================================================
// Invoke Bedrock Helper with Fallback Ladder (GAP-15 fix)
// ============================================================

function sanitizeInput(text: string): string {
  // Prevent prompt injection by escaping XML-like tags
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function invokeModelWithFallback(prompt: string, maxTokens = 500): Promise<string> {
  const models = [
    'anthropic.claude-3-5-sonnet-20240620-v1:0', // Primary: High Intelligence
    'anthropic.claude-3-haiku-20240307-v1:0'     // Fallback: Fast & Resilient
  ];
  
  let lastError = null;
  for (const modelId of models) {
    try {
      const response = await getBedrockClient().send(
        new InvokeModelCommand({
          modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }),
        })
      );
      const bodyString = new TextDecoder().decode(response.body);
      const result = JSON.parse(bodyString) as { content: [{ text: string }] };
      return result.content[0].text;
    } catch (err) {
      console.warn(`[bedrock] Model ${modelId} failed. Falling back...`, err);
      lastError = err;
    }
  }
  throw lastError;
}

// ============================================================
// Module 1: Text Analysis (Intent + Language Detection)
// ============================================================

/**
 * Analyse incoming farmer text: detect language and classify intent.
 * Returns structured JSON parsed from Claude's response.
 */
export async function analyzeIncomingText(text: string): Promise<TextAnalysisResult> {
  const sanitizedText = sanitizeInput(text);
  const prompt = `You are a multilingual classifier for a beekeeper assistant app.
Analyze the user's message and respond ONLY with valid JSON — no explanation, no markdown.

JSON format (strict):
{
  "detected_language": "<en|hi|te|bn|mr|ta>",
  "translated_english_text": "<translation if not English, else original>",
  "intent": "<MAIN_MENU|REGISTRATION|ASK_DOUBT|HEALTH_CHECK|HARVEST_MARKET|TRANSFER|UNKNOWN>"
}

Intent definitions:
- MAIN_MENU: User wants to go to the main menu or says hi/hello/start
- REGISTRATION: User wants to register or sign up
- ASK_DOUBT: User is asking a beekeeping question
- HEALTH_CHECK: User wants to check hive health or upload a bee photo
- HARVEST_MARKET: User wants to log a harvest or check market prices
- TRANSFER: User wants to transfer honey batch custody
- UNKNOWN: Cannot determine intent

User message:
<user_input>
${sanitizedText}
</user_input>`;

  try {
    const raw = await invokeModelWithFallback(prompt, 200);
    // Extract JSON even if Claude wraps it in backticks
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]) as TextAnalysisResult;
  } catch (err) {
    console.error('[bedrock] analyzeIncomingText failed:', err);
    return {
      detected_language: 'en',
      translated_english_text: text,
      intent: 'UNKNOWN',
    };
  }
}

// ============================================================
// Module 2: Beekeeping Q&A
// ============================================================

/**
 * Generate an expert beekeeping answer for a farmer's question.
 * Response is concise (1-2 sentences) and practical.
 */
export async function generateBeekeepingAdvice(
  question: string,
  context?: string
): Promise<string> {
  const sanitizedQuestion = sanitizeInput(question);
  const prompt = `You are an expert beekeeper assistant for the Pollinator platform serving Indian farmers.
Answer the question concisely in 1-3 sentences. Be practical and specific.
${context ? `Context from earlier in conversation: ${sanitizeInput(context)}` : ''}
Farmer's question (in English):
<user_input>
${sanitizedQuestion}
</user_input>`;

  try {
    return await invokeModelWithFallback(prompt, 200);
  } catch (err) {
    console.error('[bedrock] generateBeekeepingAdvice failed:', err);
    return 'I am currently unable to answer questions. Please try again shortly.';
  }
}

// ============================================================
// Module 3: Translation
// ============================================================

/**
 * Translate a bot response from English into the farmer's language.
 * Used for structured bot messages that need to be localised.
 *
 * Note: Only use Bedrock for Q&A answers (contextual phrasing matters).
 * For simple button labels, use static string maps (see handler.ts).
 */
export async function translateResponse(
  englishText: string,
  targetLanguage: SupportedLanguage
): Promise<string> {
  if (targetLanguage === 'en') return englishText;

  const languageNames: Record<SupportedLanguage, string> = {
    en: 'English',
    hi: 'Hindi',
    te: 'Telugu',
    bn: 'Bengali',
    mr: 'Marathi',
    ta: 'Tamil',
  };

  const sanitizedText = sanitizeInput(englishText);
  const prompt = `Translate the following text to ${languageNames[targetLanguage]}.
Return ONLY the translation — no explanation, no quotes.
Keep numbers and codes (like batch codes) unchanged.
Text:
<user_input>
${sanitizedText}
</user_input>`;

  try {
    return await invokeModelWithFallback(prompt, 300);
  } catch (err) {
    console.error('[bedrock] translateResponse failed:', err);
    return englishText; // Fallback to English if translation fails
  }
}
