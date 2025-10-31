import { generateText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentResponse, SearchResult } from './types';

const TRANSLATOR_SYSTEM_PROMPT = `You are a Translator Agent specialized in selecting and translating Rgveda verses for user queries.

CORPUS KNOWLEDGE - The Rgveda:
The Rgveda contains:
- 10 Mandalas (books) with 1,028 hymns (Suktas) containing 10,600+ verses (Richas)
- Verses are in Vedic Sanskrit (Devanagari script)
- Major deities: Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण), Ushas (उषस्), etc.
- Key concepts: Rita (ऋत - cosmic order), Yajna (यज्ञ - sacrifice), Dharma (धर्म)
- Famous hymns: Nasadiya Sukta (10.129 - creation), Purusha Sukta (10.90), Gayatri Mantra (3.62.10)
- Reference format: Mandala.Hymn.Verse (e.g., 10.129.1)

Your role is TWO-PHASE:

PHASE 1: SELECTION (verses are in Sanskrit - evaluate without translating yet)
1. EVALUATE each Sanskrit verse's relevance to the user's question by analyzing:
   - The verse's book context and reference
   - Key Sanskrit terms visible in the text
   - The verse's thematic content based on context
2. SELECT exactly 5-7 verses that best answer the user's question
3. Prioritize verses that directly address the query
4. If fewer than 5 relevant verses available, request additional searches

PHASE 2: TRANSLATION (only for selected verses)
1. TRANSLATE ONLY the selected verses to clear, accurate English
2. Provide scholarly, accurate translations maintaining the poetic and ritualistic context
3. Use clear, modern English while preserving the sacred nature
4. Include explanations of key Sanskrit terms when helpful

EVALUATION CRITERIA (Phase 1 - Selection):
- **HIGH RELEVANCE**: Verse directly addresses the user's question based on context and visible terms
- **MEDIUM RELEVANCE**: Verse is related to the topic but provides supporting information
- **LOW RELEVANCE**: Verse mentions the topic but is only tangentially relevant
- **IRRELEVANT**: Verse has no meaningful connection to the user's question

CRITICAL EFFICIENCY RULES:
- DO NOT translate verses you won't select - translation is expensive
- First evaluate ALL verses and SELECT the best 5-7
- Then ONLY translate those selected verses
- This saves significant processing time and focuses effort on relevant content

SELECTION STRATEGY:
- Select exactly 5-7 verses (prefer 5 unless more needed for completeness)
- Prioritize verses that directly answer the user's question
- Include supporting verses that provide important context
- Avoid redundant or overly similar verses
- If fewer than 5 relevant verses exist, request additional searches
- NEVER proceed with fewer than 5 verses unless all search options are exhausted

Response format:
- ALWAYS output ONLY a JSON object with: { "selectedVerses": [{"id": "verse_id", "translation": "English translation", "relevance": "high|medium|low", "reasoning": "why this verse is relevant"}], "totalSelected": number, "needsMoreSearch": boolean, "searchRequest": "sanskrit search term if more search needed", "reasoning": "overall selection strategy" }
- ONLY translate the selected verses (5-7 verses maximum)
- All other verses remain untranslated
- If fewer than 5 verses selected, set "needsMoreSearch": true and provide "searchRequest"
- If 5+ verses selected, set "needsMoreSearch": false and "searchRequest": ""
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

    console.log(`🔄 Translator: Evaluating ${searchResults.length} verses to select and translate ~5 best matches`);

    const translationPrompt = `${TRANSLATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Sanskrit Verses to Evaluate:
${searchResults.map((r, i) => `
${i + 1}. ID: ${r.id}
   Book Context: ${r.bookContext || 'Not specified'}
   Source: ${r.source || 'Rgveda'}
   Sanskrit Text: ${r.content?.substring(0, 200)}${(r.content?.length || 0) > 200 ? '...' : ''}
`).join('\n')}

TASK - TWO PHASES:

PHASE 1: EVALUATE & SELECT (Do this first - no translation yet!)
1. Review ALL ${searchResults.length} verses above
2. Evaluate each verse's relevance to: "${userQuery}"
3. Consider the book context and visible Sanskrit terms
4. SELECT the best 5-7 verses that answer the question
5. If fewer than 5 relevant verses, request additional search

PHASE 2: TRANSLATE (Only for selected verses)
1. ONLY translate the 5-7 verses you selected in Phase 1
2. Provide complete, scholarly English translations
3. Maintain poetic and ritualistic context
4. Do NOT waste time translating verses you didn't select

CRITICAL EFFICIENCY:
- Translate ONLY 5-7 selected verses (not all ${searchResults.length} verses)
- This is much more efficient and focuses effort on relevant content
- The generator only needs the selected verses with translations

Output ONLY a JSON object:
{
  "selectedVerses": [
    {
      "id": "verse_id_from_above",
      "translation": "Complete English translation (ONLY for selected verses)",
      "relevance": "high|medium|low",
      "reasoning": "Why this verse is relevant to the user's question"
    }
  ],
  "totalSelected": number,
  "needsMoreSearch": boolean,
  "searchRequest": "Sanskrit search term if more search needed, empty string if 5+ verses selected",
  "reasoning": "Overall selection strategy - why these specific verses answer the question"
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
        if (translationResult.needsMoreSearch && translationResult.searchRequest && selectedCount < 5) {
          console.log(`🔄 Translator requesting more search: "${translationResult.searchRequest}"`);
          console.log(`   Reasoning: ${translationResult.reasoning}`);
          
          return {
            content: `Found ${selectedCount} relevant verses, need more to reach 5. Requesting additional search.`,
            nextAgent: 'searcher',
            isComplete: false,
            requiresMoreSearch: true,
            searchQuery: translationResult.searchRequest,
            searchResults: searchResults, // Keep current results
            statusMessage: `Need more verses: ${translationResult.reasoning}`,
          };
        }
        
        const selectedSearchResults = searchResults.map(result => {
          const selectedVerse = translationResult.selectedVerses.find((v: { id: string; translation?: string; relevance?: number }) => v.id === result.id);
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
