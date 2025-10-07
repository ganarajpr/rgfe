import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModelV2 } from '@ai-sdk/provider';

/**
 * Creates a Gemini AI SDK provider
 * This allows us to use Gemini with the AI SDK's streamText, generateText, etc.
 */
export function createGeminiProvider(apiKey: string, modelName: string = 'gemini-2.5-flash'): LanguageModelV2 {
  // Create Google AI instance with API key
  const google = createGoogleGenerativeAI({
    apiKey: apiKey,
  });

  // Get the specific model
  const geminiModel = google(modelName);

  return geminiModel;
}

/**
 * Validate a Gemini API key format
 */
export async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
  try {
    // Basic validation - check if it looks like a valid API key
    return apiKey.length > 20 && apiKey.startsWith('AIza');
  } catch (error) {
    console.error('Failed to validate Gemini API key:', error);
    return false;
  }
}