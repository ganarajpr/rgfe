import { generateText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
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
3. SELECT exactly 10 verses for the final answer (or all available if fewer than 10)
4. If fewer than 10 relevant verses are available, request additional searches
5. ENSURE the generator receives properly translated and relevant verses

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
- Select EXACTLY 10 verses that together provide a complete answer
- If fewer than 10 relevant verses exist, request additional searches to find more
- If more than 10 relevant verses exist, select the 10 most important ones
- Avoid redundant or overly similar verses
- NEVER proceed with fewer than 10 verses unless all available verses have been exhausted

CRITICAL RULES:
- You MUST provide accurate translations for ALL verses you select
- You MUST evaluate each verse's relevance to the specific user question
- You MUST select exactly 10 verses to provide a comprehensive answer
- You MUST ensure the generator will have sufficient information
- NEVER select verses without providing translations
- NEVER select irrelevant verses just to fill a quota
- If fewer than 10 relevant verses are available, request additional searches
- NEVER proceed to generator with fewer than 10 verses unless all search options are exhausted

Response format:
- ALWAYS output ONLY a JSON object with: { "selectedVerses": [{"id": "verse_id", "translation": "English translation", "relevance": "high|medium|low", "reasoning": "why this verse is relevant"}], "totalSelected": number, "needsMoreSearch": boolean, "searchRequest": "sanskrit search term if more search needed", "reasoning": "overall selection strategy" }
- If fewer than 10 verses selected, set "needsMoreSearch": true and provide "searchRequest"
- If 10 or more verses selected, set "needsMoreSearch": false and "searchRequest": ""
- Ensure all selected verses have complete translations
- Provide clear reasoning for each verse selection
- Ensure the selected verses together provide comprehensive coverage of the user's question`;

export class TranslatorAgent {
  private readonly model: LanguageModelV2;

  constructor(model: LanguageModelV2) {
    this.model = model;
  }

  /**
   * Translate and evaluate verses for relevance to the user's question
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

    console.log(`🔄 Translator: Processing ${searchResults.length} verses for translation and evaluation`);

    const translationPrompt = `${TRANSLATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Sanskrit Verses to Translate and Evaluate:
${searchResults.map((r, i) => `
${i + 1}. ID: ${r.id}
   Title: ${r.title}
   Sanskrit: ${r.content}
   Source: ${r.source || 'RigVeda'}
   Book Context: ${r.bookContext || 'Not specified'}
`).join('\n')}

TASK:
1. Translate each Sanskrit verse to clear, accurate English
2. Evaluate each verse's relevance to the user's question: "${userQuery}"
3. Select EXACTLY 10 verses that together provide a comprehensive answer
4. Ensure all selected verses have complete translations
5. If fewer than 10 relevant verses exist, request additional searches to find more
6. If more than 10 relevant verses exist, select the 10 most important ones
7. NEVER proceed with fewer than 10 verses unless all search options are exhausted

IMPORTANT:
- Focus on verses that directly relate to the user's question
- Provide accurate, scholarly translations
- Select enough verses to give a complete answer
- The generator will use these translated verses to create the final response
- Do NOT select verses without providing translations

Output ONLY a JSON object:
{
  "selectedVerses": [
    {
      "id": "verse_id_from_above",
      "translation": "Complete English translation of the Sanskrit verse",
      "relevance": "high|medium|low",
      "reasoning": "Brief explanation of why this verse is relevant to the user's question"
    }
  ],
  "totalSelected": number,
  "needsMoreSearch": boolean,
  "searchRequest": "Sanskrit search term if more search needed, empty string if 10+ verses selected",
  "reasoning": "Overall strategy for verse selection and how they together answer the user's question"
}`;

    try {
      const result = await generateText({
        model: this.model,
        prompt: translationPrompt,
        temperature: 0.3,
        abortSignal: signal,
      });

      const fullResponse = result.text || '';
      console.log('🔄 Translator response:', fullResponse.substring(0, 200));

      // Parse translation response
      let translationResult;
      try {
        const jsonRegex = /\{[\s\S]*\}/;
        const jsonMatch = jsonRegex.exec(fullResponse);
        if (jsonMatch) {
          translationResult = JSON.parse(jsonMatch[0]);
        } else {
          console.log('⚠️ Could not parse translation JSON, using all verses with basic translations');
          return this.createFallbackResponse(searchResults);
        }
      } catch (parseError) {
        console.log('⚠️ JSON parse error, using fallback response:', parseError);
        return this.createFallbackResponse(searchResults);
      }

      // Process selected verses
      if (translationResult.selectedVerses && Array.isArray(translationResult.selectedVerses)) {
        const selectedCount = translationResult.selectedVerses.length;
        console.log(`📝 Translator selected ${selectedCount} verses for final answer`);
        
        // Check if we need more search
        if (translationResult.needsMoreSearch && translationResult.searchRequest && selectedCount < 10) {
          console.log(`🔄 Translator requesting more search: "${translationResult.searchRequest}"`);
          console.log(`   Reasoning: ${translationResult.reasoning}`);
          
          return {
            content: `Found ${selectedCount} relevant verses, need more to reach 10. Requesting additional search.`,
            nextAgent: 'searcher',
            isComplete: false,
            requiresMoreSearch: true,
            searchQuery: translationResult.searchRequest,
            searchResults: searchResults, // Keep current results
            statusMessage: `Need more verses: ${translationResult.reasoning}`,
          };
        }
        
        const selectedSearchResults = searchResults.map(result => {
          const selectedVerse = translationResult.selectedVerses.find((v: any) => v.id === result.id);
          if (selectedVerse) {
            return {
              ...result,
              translation: selectedVerse.translation,
              importance: selectedVerse.relevance,
              isFiltered: false, // All selected verses are relevant
            };
          }
          return {
            ...result,
            isFiltered: true, // Mark non-selected verses as filtered
          };
        });

        // Log selection summary
        const filteredCount = selectedSearchResults.filter(r => r.isFiltered).length;
        const highRelevanceCount = selectedSearchResults.filter(r => r.importance === 'high').length;
        const mediumRelevanceCount = selectedSearchResults.filter(r => r.importance === 'medium').length;
        const lowRelevanceCount = selectedSearchResults.filter(r => r.importance === 'low').length;
        
        console.log(`   📊 Selection Summary: Selected=${selectedCount}, Filtered=${filteredCount}`);
        console.log(`   📈 Relevance: High=${highRelevanceCount}, Medium=${mediumRelevanceCount}, Low=${lowRelevanceCount}`);
        console.log(`   💭 Strategy: ${translationResult.reasoning || 'No reasoning provided'}`);

        return {
          content: `Selected ${selectedCount} relevant verses with translations for comprehensive answer.`,
          nextAgent: 'generator',
          isComplete: true,
          searchResults: selectedSearchResults,
          statusMessage: `Translated and selected ${selectedCount} verses (${filteredCount} filtered out)`,
        };
      }

      console.log('⚠️ No verses selected, using fallback response');
      return this.createFallbackResponse(searchResults);

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
