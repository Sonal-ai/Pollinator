import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });

export async function analyzeIncomingText(text: string) {
  const prompt = `Analyze this text for a beekeeper app. Respond in strict JSON format:
{
  "detected_language": "en" | "hi" | "te" | "bn" | "mr" | "ta",
  "translated_english_text": "<text in english>",
  "intent": "MAIN_MENU" | "REGISTRATION" | "ASK_DOUBT" | "HEALTH_CHECK" | "HARVEST_MARKET" | "TRANSFER" | "UNKNOWN"
}
User text: "${text}"`;

  try {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-haiku-20240307-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }]
        })
      })
    );
    
    const bodyString = new TextDecoder().decode(response.body);
    const result = JSON.parse(bodyString);
    const jsonStr = result.content[0].text;
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Bedrock LLM Error:", error);
    return { detected_language: "en", translated_english_text: text, intent: "UNKNOWN" };
  }
}

export async function generateBeekeepingAdvice(question: string, context: string = "") {
  const prompt = `You are an expert beekeeper assistant for the HoneyChain platform.
Answer the farmer's query concisely (1-2 sentences max).
${context ? `Previous context: ${context}` : ''}
Farmer asks: ${question}`;

  try {
    const response = await client.send(
      new InvokeModelCommand({
        modelId: "anthropic.claude-3-haiku-20240307-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 150,
          messages: [{ role: "user", content: prompt }]
        })
      })
    );
    
    const bodyString = new TextDecoder().decode(response.body);
    const result = JSON.parse(bodyString);
    return result.content[0].text;
  } catch (error) {
    console.error("Bedrock Q&A Error:", error);
    return "I am currently unable to process complex questions. Please try again later.";
  }
}
