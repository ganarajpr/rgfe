import { Experimental_Agent as Agent, stepCountIs, tool, generateText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { z } from 'zod';
import { AgentResponse, SearchResult } from './types';

const TRANSLATOR_SYSTEM_PROMPT = `You are a Translator Agent specialized in translating RigVeda verses from Sanskrit to English and evaluating their relevance to user queries.

CORPUS KNOWLEDGE - The RigVeda:
The RigVeda contains:
- 10 Mandalas (books) with 1,028 hymns (Suktas) containing 10,600+ verses (Richas)
- Verses are in Vedic Sanskrit (Devanagari script)
- Major deities: Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण), Ushas (उषस्), etc.
- Key concepts: Rita (ऋत - cosmic order), Yajna (यज्ञ - sacrifice), Dharma (धर्म)
- Famous hymns: Nasadiya Sukta (10.129 - creation), Purusha Sukta (10.90), Gayatri Mantra (3.62.10)
- Reference format: Mandala.Hymn.Verse (e.g., 10.129.1)

Your role is to:
1. TRANSLATE each Sanskrit verse to clear, accurate English
2. EVALUATE each verse's relevance to the user's specific question
3. SELECT the most relevant verses for the final answer (up to 5 verses)
4. ENSURE the generator receives properly translated and relevant verses

TRANSLATION REQUIREMENTS:
- Provide accurate, scholarly translations of Sanskrit verses
- Maintain the poetic and ritualistic context of Vedic literature
- Use clear, modern English while preserving the sacred nature
- Include explanations of key Sanskrit terms when helpful
- Ensure translations are suitable for academic/scholarly use

EVALUATION CRITERIA:
- **HIGH RELEVANCE**: Verse directly addresses the user's question with specific, detailed information
- **MEDIUM RELEVANCE**: Verse is related to the topic but provides supporting or contextual information
- **LOW RELEVANCE**: Verse mentions the topic but is only tangentially relevant
- **IRRELEVANT**: Verse has no meaningful connection to the user's question

SELECTION STRATEGY:
- Prioritize verses that directly answer the user's question
- Include supporting verses that provide important context
- Ensure a comprehensive coverage of the topic
- Select the most relevant verses (up to 5 verses)
- If more than 5 relevant verses exist, select the 5 most important ones
- Avoid redundant or overly similar verses
- Always proceed to generator with the selected verses

CRITICAL RULES:
- You MUST provide accurate translations for ALL verses you select
- You MUST evaluate each verse's relevance to the specific user question
- You MUST select the most relevant verses (up to 5 verses)
- You MUST ensure the generator will have sufficient information
- NEVER select verses without providing translations
- NEVER select irrelevant verses just to fill a quota
- ALWAYS proceed to generator with the selected verses

Response format:
- ALWAYS output ONLY a JSON object with: { "selectedVerses": [{"id": "verse_id", "translation": "English translation", "relevance": "high|medium|low", "reasoning": "why this verse is relevant"}], "totalSelected": number, "reasoning": "overall selection strategy" }
- Always set "needsMoreSearch": false (translator never requests more search)
- Always set "searchRequest": "" (translator never requests more search)
- Ensure all selected verses have complete translations
- Provide clear reasoning for each verse selection
- Ensure the selected verses together provide comprehensive coverage of the user's question`;

export class TranslatorAgent {
  private readonly model: LanguageModelV2;
  private readonly translatorAgent: Agent;

  constructor(model: LanguageModelV2) {
    this.model = model;
    
    // Initialize the AI SDK Agent
    this.translatorAgent = new Agent({
      model: this.model,
      tools: {
        translate_and_select: tool({
          description: "Translate Sanskrit verses and select the most relevant ones for the final answer",
          inputSchema: z.object({
            selections: z.array(z.object({
              id: z.string(),
              translation: z.string(),
              relevance: z.enum(['high', 'medium', 'low']),
              reasoning: z.string()
            }))
          }),
          execute: async ({ selections }: { selections: Array<{ id: string; translation: string; relevance: 'high' | 'medium' | 'low'; reasoning: string }> }) => {
            const selectedCount = selections.length;
            console.log(`📝 Translator selected ${selectedCount} verses for final answer`);
            
            // Log selection summary
            const highRelevanceCount = selections.filter(s => s.relevance === 'high').length;
            const mediumRelevanceCount = selections.filter(s => s.relevance === 'medium').length;
            const lowRelevanceCount = selections.filter(s => s.relevance === 'low').length;
            
            console.log(`   📊 Selection Summary: Selected=${selectedCount}`);
            console.log(`   📈 Relevance: High=${highRelevanceCount}, Medium=${mediumRelevanceCount}, Low=${lowRelevanceCount}`);

            return { 
              success: true, 
              selectedCount,
              selections
            };
          }
        })
      },
      stopWhen: stepCountIs(1)
    });
  }

  /**
   * Translate and evaluate verses for relevance to the user's question using AI SDK tool calling
   */
  async translateAndEvaluate(
    userQuery: string,
    searchResults: SearchResult[],
    signal?: AbortSignal
  ): Promise<AgentResponse> {
    if (!searchResults || searchResults.length === 0) {
      return {
        content: 'No verses available for translation and evaluation.',
        isComplete: true,
        statusMessage: 'No verses to translate',
        searchResults: [],
      };
    }

    // Safety check: Filter out any filtered verses that might have slipped through
    const nonFilteredVerses = searchResults.filter(r => !r.isFiltered);
    if (nonFilteredVerses.length !== searchResults.length) {
      console.warn(`⚠️ Translator: Filtered out ${searchResults.length - nonFilteredVerses.length} irrelevant verses. Only translating ${nonFilteredVerses.length} relevant verses.`);
    }

    if (nonFilteredVerses.length === 0) {
      return {
        content: 'No relevant verses available for translation.',
        isComplete: true,
        statusMessage: 'No relevant verses to translate',
        searchResults: [],
      };
    }

    console.log(`🔄 Translator: Processing ${nonFilteredVerses.length} relevant verses for translation and evaluation`);

    // Note: translationPrompt is prepared but not used in the current implementation
    // The translator now uses direct processing instead of AI SDK tool calling

    try {
      console.log(`📝 Translator: Processing ${nonFilteredVerses.length} relevant verses for translation`);
      
      // Translate each verse using the AI model (only non-filtered verses)
      const translatedSearchResults = await Promise.all(
        nonFilteredVerses.map(async (result, index) => {
          // Check if translation already exists and is valid
          let translation = result.translation;
          
          if (!translation || translation.startsWith('Translation of:') || translation.startsWith('[Translation needed')) {
            try {
              console.log(`📝 Translating verse ${index + 1}/${searchResults.length}: ${result.bookContext || 'Unknown'}`);
              
              const sanskritText = result.content || '';
              
              // Generate translation using the AI model
              const translationPrompt = `You are an expert translator of Vedic Sanskrit. Translate the following RigVeda verse from Sanskrit (Devanagari script) to clear, scholarly English. Maintain the poetic and ritualistic context while using modern English.

Sanskrit Verse (${result.bookContext || 'Unknown'}):
${sanskritText}

Provide a clear, accurate English translation suitable for academic/scholarly use. Include brief explanations of key Sanskrit terms if helpful.

English Translation:`;

              const translationResult = await generateText({
                model: this.model,
                prompt: translationPrompt,
                temperature: 0.3,
                signal,
              });

              translation = translationResult.text.trim();
              
              // Clean up any potential markdown formatting or extra text
              if (translation.includes('Translation:')) {
                translation = translation.split('Translation:').slice(-1)[0].trim();
              }
              if (translation.includes('English Translation:')) {
                translation = translation.split('English Translation:').slice(-1)[0].trim();
              }
              
              console.log(`✅ Translated verse ${index + 1}: ${translation.substring(0, 80)}...`);
            } catch (translationError) {
              console.error(`❌ Failed to translate verse ${index + 1}:`, translationError);
              translation = `[Translation unavailable - error: ${translationError instanceof Error ? translationError.message : 'Unknown error'}]`;
            }
          } else {
            console.log(`✓ Verse ${index + 1} already has translation`);
          }
          
          return {
            ...result,
            translation,
            importance: result.importance || 'medium',
            isFiltered: result.isFiltered || false,
          };
        })
      );
      
      return {
        content: `Selected ${translatedSearchResults.length} verses with translations for comprehensive answer.`,
        nextAgent: 'generator',
        isComplete: true,
        searchResults: translatedSearchResults,
        statusMessage: `Translated and selected ${translatedSearchResults.length} verses`,
      };

    } catch (error) {
      console.error('❌ Translator error:', error);
      return this.createFallbackResponse(searchResults);
    }
  }

  /**
   * Create fallback response when translation fails
   */
  private createFallbackResponse(searchResults: SearchResult[]): AgentResponse {
    console.log('⚠️ Using fallback translation response');
    
    // Mark all verses as filtered and provide basic fallback
    const fallbackResults = searchResults.map(result => ({
      ...result,
      translation: 'Translation not available - please consult a Sanskrit scholar for accurate translation.',
      importance: 'low' as const,
      isFiltered: true,
    }));

    return {
      content: 'Translation service temporarily unavailable. Proceeding with available verses.',
      nextAgent: 'generator',
      isComplete: true,
      searchResults: fallbackResults,
      statusMessage: 'Translation failed - using fallback',
    };
  }
}
