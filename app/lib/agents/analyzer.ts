import { Experimental_Agent as Agent, stepCountIs, tool, generateText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { z } from 'zod';
import { AgentResponse, SearchResult } from './types';

// Note: ANALYZER_SYSTEM_PROMPT is defined but not used in the current implementation
// The analyzer now uses direct content-based evaluation instead of AI SDK tool calling
const ANALYZER_SYSTEM_PROMPT = `You are an Analyzer Agent specialized in evaluating RigVeda search results and determining if additional searches are needed.

CORPUS KNOWLEDGE - The RigVeda:
The search corpus contains verses from the RigVeda, the oldest of the four Vedas. It consists of:
- 10 Mandalas (books) with 1,028 hymns (Suktas) containing 10,600+ verses (Richas)
- Verses are in Vedic Sanskrit (Devanagari script)
- Major deities: Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण), Ushas (उषस्), etc.
- Key concepts: Rita (ऋत - cosmic order), Yajna (यज्ञ - sacrifice), Dharma (धर्म)
- Famous hymns: Nasadiya Sukta (10.129 - creation), Purusha Sukta (10.90), Gayatri Mantra (3.62.10)
- Reference format: Mandala.Hymn.Verse (e.g., 10.129.1)

Your role in the ITERATIVE SEARCH-ANALYSIS LOOP:
1. EVALUATE each verse individually for relevancy to the user's query based on CONTENT, not search scores
2. ASSIGN importance levels (high/medium/low) to each verse based on how well it answers the question
3. MARK irrelevant verses as filtered (but keep them in results)
4. COUNT only non-filtered verses as "relevant"
5. STOP when sufficient verses found OR 5 iterations reached
6. If INSUFFICIENT relevant verses: Request ONE specific search with a RigVeda-contextual Sanskrit term

VERSE-BY-VERSE EVALUATION:
For each search result, you must:
- Read the Sanskrit verse content carefully
- Evaluate if the verse directly relates to the user's query based on meaning and context
- Assign importance level: high (directly answers), medium (partially relevant), low (tangentially related)
- Mark as filtered if completely irrelevant to the query
- Provide brief reasoning for each evaluation
- IGNORE search engine relevance scores - make independent assessments

IMPORTANCE LEVELS:
- **HIGH**: Verse directly addresses the user's question with specific, relevant information
- **MEDIUM**: Verse is related to the topic but provides supporting or contextual information
- **LOW**: Verse mentions the topic but is only tangentially relevant
- **FILTERED**: Verse is completely irrelevant to the user's query

ANALYSIS PHASE (when evaluating search results):
- Review ALL search results and their Sanskrit content
- **CONTENT EVALUATION**: Read each verse and assess if it directly relates to the user's query
  Example: For "hymns to Agni" → look for verses mentioning Agni (अग्नि), fire, or fire-related rituals
  Example: For "Nasadiya Sukta" → look for creation-related verses or specific references to 10.129
- **RELEVANCE ASSESSMENT**: Determine if verses actually answer the user's question
- **GAP IDENTIFICATION**: Identify what information is missing to fully answer the query
- Consider the current iteration count (max 5 loops)

When requesting additional search (when content doesn't match the query):
- Provide ONE focused search term in Sanskrit/Devanagari (देवनागरी)
- Make KNOWLEDGEABLE GUESSES based on RigVeda context
- Consider: deity names, hymn references, Sanskrit concepts, ritual terms
- Think: "What would a RigVeda scholar search for to find this?"
- Explain why current results are insufficient and what you're looking for

INTELLIGENT SEARCH TERM GENERATION:
- English deity name → Sanskrit name (e.g., "Fire God" → "अग्नि")
- Concept → Sanskrit term (e.g., "cosmic order" → "ऋत")
- Famous hymn → Direct Sanskrit or Mandala reference (e.g., "Nasadiya" → "नासदीय" or "मण्डल १०")
- Ritual → Sanskrit ritual term (e.g., "sacrifice" → "यज्ञ")

CRITICAL RULES:
- You MUST ONLY analyze based on the RigVeda search results provided
- NEVER use your own general knowledge or information from other texts
- IGNORE search engine relevance scores - evaluate content independently
- If results are insufficient even after 5 loops, state that clearly
- ONLY discuss the RigVeda - NOT other Vedas, Upanishads, Puranas, or epics
- When content doesn't match the query, use your RigVeda knowledge to suggest better search terms
- Maintain scholarly rigor by only using verified sources

Response format:
- ALWAYS output ONLY a JSON object with: { "needsMoreSearch": boolean, "searchRequest": "sanskrit term", "reasoning": "explanation of content evaluation and what's needed", "verseEvaluations": [{"id": "verse_id", "importance": "high|medium|low", "isFiltered": boolean, "reasoning": "brief explanation"}] }
- If needsMoreSearch is false, searchRequest can be empty string
- Ensure searchRequest uses VALID UTF-8 Devanagari characters
- Use Devanagari numerals carefully: १ (1), २ (2), ३ (3), ४ (4), ५ (5), ६ (6), ७ (7), ८ (8), ९ (9), ० (0)
- If referencing Mandala numbers, you can use either: "मण्डल 10" or "मण्डल १०" (both valid)
- Avoid mixing scripts unnecessarily - keep search terms focused
- Be creative: try alternative Sanskrit synonyms, different deity names, or conceptual terms`;

export class AnalyzerAgent {
  private readonly model: LanguageModelV2;
  private readonly maxSearchIterations = 5; // Maximum 5 iterations (0, 1, 2, 3, 4, 5 = 6 total attempts - 1 initial + 5 refinements)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly analyzerAgent: any;

  constructor(model: LanguageModelV2) {
    this.model = model;
    
    // Initialize the AI SDK Agent
    this.analyzerAgent = new Agent({
      model: this.model,
      tools: {
        evaluate_verses: tool({
          description: "Evaluate each verse for relevance and assign importance levels",
          inputSchema: z.object({
            evaluations: z.array(z.object({
              id: z.string(),
              importance: z.enum(['high', 'medium', 'low']),
              isFiltered: z.boolean(),
              reasoning: z.string()
            }))
          }),
          execute: async ({ evaluations }: { evaluations: Array<{ id: string; importance: 'high' | 'medium' | 'low'; isFiltered: boolean; reasoning: string }> }) => {
            console.log(`📊 Applying verse evaluations to ${evaluations.length} verses`);
            
            // This would be implemented to process the evaluations
            // For now, return a success response
            return { 
              success: true, 
              evaluationsProcessed: evaluations.length
            };
          }
        }),
        request_more_search: tool({
          description: "Request additional search with a new Sanskrit term",
          inputSchema: z.object({
            searchQuery: z.string(),
            reasoning: z.string()
          }),
          execute: async ({ searchQuery, reasoning }: { searchQuery: string; reasoning: string }) => {
            // Ensure the search request contains Devanagari script
            const hasDevanagari = /[\u0900-\u097F]/.test(searchQuery);
            
            if (hasDevanagari) {
              const cleanedSearchRequest = searchQuery.trim();
              console.log(`🔄 Analyzer requesting additional search: "${cleanedSearchRequest}"`);
              console.log(`   Reasoning: ${reasoning}`);
              return { 
                success: true, 
                searchQuery: cleanedSearchRequest,
                reasoning,
                requiresMoreSearch: true
              };
            } else {
              console.log('⚠️ Search request not in Sanskrit/Devanagari script, proceeding with available results');
              return { 
                success: false, 
                error: 'Search request not in Sanskrit/Devanagari script'
              };
            }
          }
        }),
        complete_analysis: tool({
          description: "Mark analysis as complete and proceed to next step",
          inputSchema: z.object({
            reasoning: z.string()
          }),
          execute: async ({ reasoning }: { reasoning: string }) => {
            console.log(`✅ Analyzer: Sufficient information available: ${reasoning}`);
            return { 
              success: true, 
              reasoning,
              isComplete: true
            };
          }
        })
      },
      stopWhen: stepCountIs(3)
    });
  }


  /**
   * Analyze search results and determine if more search is needed using strict LLM-based evaluation
   * 
   * @param userQuery - The original user question
   * @param searchQuery - The search term/query that was used to find these results (for context)
   * @param searchResults - Verses found by the search (IGNORE relevance scores)
   * @param iterationCount - Current iteration number (0-4)
   * @param previousSearchTerms - Terms already searched to avoid repetition
   */
  async analyze(
    userQuery: string,
    searchQuery: string,
    searchResults: SearchResult[],
    iterationCount: number,
    previousSearchTerms: string[] = []
  ): Promise<AgentResponse> {
    if (iterationCount >= this.maxSearchIterations) {
      console.log(`⚠️ Max search iterations (${this.maxSearchIterations}) reached, proceeding with available results`);
      return {
        content: 'Maximum search iterations reached. Proceeding with available results.',
        isComplete: true,
        statusMessage: 'Analysis complete - max iterations reached',
        searchResults: searchResults,
      };
    }

    try {
      console.log(`📊 Analyzer: Starting STRICT analysis of ${searchResults.length} verses`);
      console.log(`📊 Analyzer: User Query: "${userQuery}"`);
      console.log(`📊 Analyzer: Search Query Used: "${searchQuery}"`);
      console.log(`📊 Analyzer: Iteration ${iterationCount + 1}/${this.maxSearchIterations + 1}`);
      console.log(`📊 Analyzer: Previous search terms: ${previousSearchTerms.join(', ')}`);
      console.log(`📊 Analyzer: IGNORING search relevance scores - evaluating content independently\n`);

      // Special handling: Check if this is from a book context search
      // Book context search results should be marked as relevant by default
      const isBookContextSearch = searchResults.length > 0 && 
        searchResults.some(r => r.bookContext && /^\d+\.\d+(\.\d+)?$/.test(r.bookContext));
      
      // Use LLM-based strict analysis instead of simple string matching
      // This ensures we evaluate verses based on actual meaning, not just keyword matches
      
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📊 STRICT LLM-BASED VERSE ANALYSIS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Analyzing ${searchResults.length} verses for user query: "${userQuery}"`);
      console.log(`Search query used: "${searchQuery}"`);
      console.log('⚠️ IGNORING search relevance scores - evaluating content independently');
      console.log('───────────────────────────────────────────────────────────\n');

      // Prepare verses for analysis (remove relevance scores from display)
      const versesForAnalysis = searchResults.map((result, index) => ({
        id: `verse_${index}_${result.bookContext || 'unknown'}`,
        bookContext: result.bookContext || 'Unknown',
        sanskritText: result.content || '',
        title: result.title || '',
        // Explicitly NOT including relevance score - we evaluate independently
      }));

      // Create prompt for strict LLM-based evaluation
      const analysisPrompt = `${ANALYZER_SYSTEM_PROMPT}

USER QUERY: "${userQuery}"
SEARCH QUERY USED: "${searchQuery}"
PREVIOUS SEARCH TERMS TRIED: ${previousSearchTerms.length > 0 ? previousSearchTerms.join(', ') : 'None (first search)'}
CURRENT ITERATION: ${iterationCount + 1} of ${this.maxSearchIterations + 1}

VERSES TO EVALUATE (${versesForAnalysis.length} verses):
${versesForAnalysis.map((v, i) => `
${i + 1}. Verse ${v.bookContext}
   Sanskrit Text: ${v.sanskritText.substring(0, 200)}${v.sanskritText.length > 200 ? '...' : ''}
   Title: ${v.title}
`).join('\n')}

CRITICAL EVALUATION RULES:
1. IGNORE any search relevance scores - evaluate each verse based ONLY on its content
2. Be STRICT - a verse must actually relate to the user's query, not just contain similar words
3. For each verse, determine:
   - Does it directly answer the user's question? (HIGH importance)
   - Does it provide relevant supporting information? (MEDIUM importance)  
   - Is it only tangentially related? (LOW importance)
   - Is it completely irrelevant? (FILTERED = true)

4. Example: If user asks "What is the Nasadiya Sukta about?", verses must:
   - Explicitly be from Mandala 10, Hymn 129 OR discuss the specific creation philosophical questions (HIGH)
   - Discuss cosmic origins/creation directly related to that hymn (MEDIUM)
   - Just mention creation but not the specific hymn context (LOW)
   - Not relate to Nasadiya Sukta at all - even if they're about other topics (FILTERED)

5. CRITICAL: If the user asks about a SPECIFIC hymn/sukta (like Nasadiya, Purusha, etc.):
   - Verses MUST be from that specific hymn OR directly discuss its specific content
   - General verses about the same deity/topic but NOT from that hymn should be FILTERED
   - If asking "What is X Sukta about?" and you don't see verses from that Sukta, mark ALL as FILTERED
   - Suggest searching for the specific Mandala.Hymn reference (e.g., "10.129")

6. For "${userQuery}", be especially strict about what constitutes relevance.

OUTPUT FORMAT (JSON ONLY):
{
  "verseEvaluations": [
    {
      "id": "verse_0_10.129.1",
      "importance": "high|medium|low",
      "isFiltered": true|false,
      "reasoning": "Brief explanation of why this verse is/is not relevant"
    }
  ],
  "needsMoreSearch": true|false,
  "searchRequest": "sanskrit term or empty string",
  "reasoning": "Overall assessment: why these verses are/aren't sufficient"
}`;

      // Call LLM for strict evaluation
      let llmEvaluation: {
        verseEvaluations?: Array<{
          id: string;
          importance: 'high' | 'medium' | 'low';
          isFiltered: boolean;
          reasoning: string;
        }>;
        needsMoreSearch?: boolean;
        searchRequest?: string;
        reasoning?: string;
      };

      try {
        const result = await generateText({
          model: this.model,
          prompt: analysisPrompt,
          temperature: 0.3, // Lower temperature for more consistent evaluation
        });

        // Parse JSON response
        const responseText = result.text.trim();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          throw new Error('No JSON found in LLM response');
        }

        llmEvaluation = JSON.parse(jsonMatch[0]);
        
        console.log('✅ LLM evaluation received');
        console.log(`   - Verses evaluated: ${llmEvaluation.verseEvaluations?.length || 0}`);
        console.log(`   - Needs more search: ${llmEvaluation.needsMoreSearch || false}`);
      } catch (error) {
        console.error('❌ LLM evaluation failed, falling back to strict content-based analysis:', error);
        
        // Fallback to stricter content-based evaluation
        llmEvaluation = {
          verseEvaluations: versesForAnalysis.map(v => ({
            id: v.id,
            importance: 'low' as const,
            isFiltered: true, // Default to filtered - be strict!
            reasoning: 'Could not evaluate with LLM - defaulting to filtered',
          })),
          needsMoreSearch: true,
          searchRequest: '',
          reasoning: 'LLM evaluation failed, need more search',
        };
      }

      // Apply LLM evaluations to search results
      const updatedSearchResults = searchResults.map((result, index) => {
        const verseId = `verse_${index}_${result.bookContext || 'unknown'}`;
        const evaluation = llmEvaluation.verseEvaluations?.find(e => e.id === verseId);

        // Special case: Book context searches are always relevant
        if (isBookContextSearch && result.bookContext) {
          console.log(`\n📊 VERSE ${index + 1}: ${result.bookContext}`);
          console.log('   ✓ SELECTED (Book Context Search - Explicitly Requested)');
          return {
            ...result,
            importance: 'high' as const,
            isFiltered: false,
            analysisReasoning: 'Explicitly requested by book context reference',
          };
        }

        if (!evaluation) {
          console.log(`\n📊 VERSE ${index + 1}: ${result.bookContext || 'Unknown'}`);
          console.log('   ✗ REJECTED (No evaluation found - defaulting to filtered)');
          return {
            ...result,
            importance: 'low' as const,
            isFiltered: true,
            analysisReasoning: 'No evaluation found - defaulting to filtered',
          };
        }

        console.log(`\n📊 VERSE ${index + 1}: ${result.bookContext || 'Unknown'}`);
        console.log(`   Importance: ${evaluation.importance.toUpperCase()}`);
        console.log(`   Filtered: ${evaluation.isFiltered ? 'YES' : 'NO'}`);
        console.log(`   Reasoning: ${evaluation.reasoning}`);
        console.log(`   Text preview: ${(result.content || '').substring(0, 60)}...`);

        return {
          ...result,
          importance: evaluation.importance,
          isFiltered: evaluation.isFiltered,
          analysisReasoning: evaluation.reasoning,
        };
      });
      
      // Summary logging
      console.log('\n───────────────────────────────────────────────────────────');
      console.log('📊 ANALYSIS SUMMARY');
      console.log('───────────────────────────────────────────────────────────');
      const relevantCount = updatedSearchResults.filter(r => !r.isFiltered).length;
      const filteredCount = updatedSearchResults.length - relevantCount;
      const highImportance = updatedSearchResults.filter(r => !r.isFiltered && r.importance === 'high').length;
      const mediumImportance = updatedSearchResults.filter(r => !r.isFiltered && r.importance === 'medium').length;
      const lowImportance = updatedSearchResults.filter(r => !r.isFiltered && r.importance === 'low').length;
      
      // Extract query terms for summary
      const queryTerms = userQuery.toLowerCase().split(' ').filter(word => word.length > 2);
      
      console.log(`Total verses analyzed: ${searchResults.length}`);
      console.log(`\n✓ Selected (relevant): ${relevantCount}`);
      console.log(`  - High importance: ${highImportance} (direct + Sanskrit matches)`);
      console.log(`  - Medium importance: ${mediumImportance} (direct OR Sanskrit matches)`);
      console.log(`  - Low importance: ${lowImportance} (partial matches only)`);
      console.log(`\n✗ Rejected (filtered): ${filteredCount}`);
      if (filteredCount > 0) {
        console.log(`  Reasons for rejection:`);
        console.log(`    - No text matches: ${filteredCount} verses`);
        console.log(`    - Does not relate to query terms: ${queryTerms.join(', ')}`);
      }
      
      // Decision rationale
      console.log(`\n💭 Decision Rationale:`);
      if (relevantCount === 0) {
        console.log(`  ❌ No verses match the query - need different search approach`);
      } else if (relevantCount < 2) {
        console.log(`  ⚠️ Insufficient verses (${relevantCount}) - need more for comprehensive answer`);
      } else if (relevantCount >= 2 && relevantCount < 5) {
        console.log(`  ✓ Adequate verses (${relevantCount}) - sufficient for answer`);
      } else {
        console.log(`  ✓ Excellent coverage (${relevantCount} verses) - maximum reached`);
      }
      console.log('═══════════════════════════════════════════════════════════\n');
      
      // Use LLM's decision about whether more search is needed
      let requiresMoreSearch = llmEvaluation.needsMoreSearch || false;
      let searchQuery = llmEvaluation.searchRequest || '';
      let statusMessage: string;

      // Validate LLM's needsMoreSearch decision against actual results
      // Even if LLM says no, we should check if we have enough high-quality verses
      const highQualityVerses = updatedSearchResults.filter(
        r => !r.isFiltered && (r.importance === 'high' || r.importance === 'medium')
      ).length;

      // Be strict: require at least 2 high-quality verses
      if (highQualityVerses < 2 && iterationCount < this.maxSearchIterations) {
        requiresMoreSearch = true;
        
        // If LLM didn't provide a search suggestion, generate one
        if (!searchQuery || searchQuery.trim() === '') {
          searchQuery = this.generateIntelligentSearchTerm(userQuery, previousSearchTerms);
        }
        
        statusMessage = `Need more information: Only ${highQualityVerses} high-quality verses found (${relevantCount} total relevant)`;
        
        // Log detailed reasoning for search suggestion
        console.log('\n───────────────────────────────────────────────────────────');
        console.log('🔍 SEARCH SUGGESTION');
        console.log('───────────────────────────────────────────────────────────');
        console.log(`Current situation:`);
        console.log(`  - Relevant verses found: ${relevantCount} (need at least 2)`);
        console.log(`  - Total verses analyzed: ${searchResults.length}`);
        console.log(`  - Rejected verses: ${filteredCount}`);
        console.log(`  - Search iteration: ${iterationCount + 1}/${this.maxSearchIterations + 1}`);
        console.log(`\nWhy more search is needed:`);
        if (relevantCount === 0) {
          console.log(`  ❌ No relevant verses found at all`);
          console.log(`  💭 The current search terms did not match any verse content`);
        } else if (relevantCount === 1) {
          console.log(`  ⚠️ Only 1 relevant verse found (need at least 2 for comprehensive answer)`);
          console.log(`  💭 Need more verses to provide complete coverage of the topic`);
        }
        console.log(`\nSearch suggestion rationale:`);
        console.log(`  Original query: "${userQuery}"`);
        if (previousSearchTerms.length > 0) {
          console.log(`  Previous search terms tried: ${previousSearchTerms.join(', ')}`);
          console.log(`  💭 Previous searches did not yield sufficient results`);
        }
        console.log(`  Suggested search term: "${searchQuery}"`);
        console.log(`  💭 This term should help find verses more aligned with the query`);
        console.log(`  💭 Using alternative Sanskrit/deity/concept terminology`);
        console.log('───────────────────────────────────────────────────────────\n');
        console.log(`\n💭 LLM Reasoning: ${llmEvaluation.reasoning || 'No reasoning provided'}`);
      } else if (relevantCount >= 5 || highQualityVerses >= 3) {
        // If we have 5+ relevant verses or 3+ high-quality verses, we can stop
        requiresMoreSearch = false;
        statusMessage = `Analysis complete: Found ${relevantCount} relevant verses (${highQualityVerses} high-quality)`;
        console.log(`📊 Analyzer: Analysis complete - sufficient high-quality verses found`);
      } else {
        requiresMoreSearch = false; // LLM says we have enough
        statusMessage = `Analysis complete: Found ${relevantCount} relevant verses (${highQualityVerses} high-quality)`;
        console.log(`📊 Analyzer: Analysis complete - proceeding with ${relevantCount} relevant verses`);
        if (llmEvaluation.reasoning) {
          console.log(`💭 LLM Reasoning: ${llmEvaluation.reasoning}`);
        }
      }

      // Determine final response
      if (requiresMoreSearch && searchQuery.trim() !== '' && iterationCount < this.maxSearchIterations) {
        return {
          content: statusMessage,
          nextAgent: 'searcher',
          isComplete: false,
          requiresMoreSearch: true,
          searchQuery: searchQuery,
          statusMessage: statusMessage,
          searchResults: updatedSearchResults,
        };
      } else {
        return {
          content: 'Analysis complete - sufficient information gathered.',
          isComplete: true,
          statusMessage: statusMessage,
          searchResults: updatedSearchResults,
        };
      }

    } catch (error) {
      console.error('❌ Analyzer error:', error);
      return {
        content: 'Analysis complete - proceeding with available results.',
        isComplete: true,
        statusMessage: 'Analysis complete - proceeding with generation',
        searchResults: searchResults,
      };
    }
  }

  /**
   * Check if Sanskrit content is relevant to the user query
   */
  private checkSanskritRelevance(content: string, userQuery: string): boolean {
    // Common Sanskrit deity and concept mappings
    const sanskritMappings: Record<string, string[]> = {
      'agni': ['अग्नि', 'agni', 'fire', 'flame'],
      'indra': ['इन्द्र', 'indra', 'thunder', 'storm'],
      'soma': ['सोम', 'soma', 'moon', 'nectar'],
      'varuna': ['वरुण', 'varuna', 'water', 'ocean'],
      'ushas': ['उषस्', 'ushas', 'dawn', 'morning'],
      'vayu': ['वायु', 'vayu', 'wind', 'air'],
      'surya': ['सूर्य', 'surya', 'sun', 'solar'],
      'chandra': ['चन्द्र', 'chandra', 'moon', 'lunar'],
      'rit': ['ऋत', 'rita', 'order', 'cosmic'],
      'yajna': ['यज्ञ', 'yajna', 'sacrifice', 'ritual'],
      'dharma': ['धर्म', 'dharma', 'duty', 'righteousness'],
      'brahma': ['ब्रह्म', 'brahma', 'creator', 'supreme'],
      'vishnu': ['विष्णु', 'vishnu', 'preserver', 'protector'],
      'shiva': ['शिव', 'shiva', 'destroyer', 'auspicious'],
      'hymn': ['स्तोत्र', 'stotra', 'hymn', 'praise'],
      'praise': ['स्तुति', 'stuti', 'praise', 'worship'],
      'worship': ['पूजा', 'puja', 'worship', 'devotion'],
    };

    // Check if any Sanskrit terms in the content match concepts from the user query
    for (const [concept, terms] of Object.entries(sanskritMappings)) {
      if (userQuery.toLowerCase().includes(concept)) {
        const hasMatch = terms.some(term => content.includes(term));
        if (hasMatch) {
          console.log(`📊 Sanskrit match found: "${concept}" -> "${terms.find(term => content.includes(term))}"`);
        }
        return hasMatch;
      }
    }

    return false;
  }

  /**
   * Generate intelligent search terms based on user query and previous attempts
   */
  private generateIntelligentSearchTerm(userQuery: string, previousTerms: string[]): string {
    const userQueryLower = userQuery.toLowerCase();
    
    // Check for specific hymn references that should use book context search
    const hymnMappings: Record<string, string> = {
      'nasadiya': '10.129',
      'purusha': '10.90',
      'gayatri': '3.62.10',
    };
    
    // If user is asking about a specific hymn, suggest book context search
    for (const [hymnName, reference] of Object.entries(hymnMappings)) {
      if (userQueryLower.includes(hymnName) && !previousTerms.includes(reference)) {
        console.log(`🎯 Detected specific hymn query: "${hymnName}" → suggesting book context: "${reference}"`);
        return reference;
      }
    }
    
    // Map English terms to Sanskrit equivalents
    const termMappings: Record<string, string> = {
      'fire': 'अग्नि',
      'agni': 'अग्नि',
      'thunder': 'इन्द्र',
      'indra': 'इन्द्र',
      'storm': 'इन्द्र',
      'moon': 'सोम',
      'soma': 'सोम',
      'water': 'वरुण',
      'varuna': 'वरुण',
      'ocean': 'वरुण',
      'dawn': 'उषस्',
      'ushas': 'उषस्',
      'morning': 'उषस्',
      'wind': 'वायु',
      'vayu': 'वायु',
      'air': 'वायु',
      'sun': 'सूर्य',
      'surya': 'सूर्य',
      'solar': 'सूर्य',
      'order': 'ऋत',
      'rita': 'ऋत',
      'cosmic': 'ऋत',
      'sacrifice': 'यज्ञ',
      'yajna': 'यज्ञ',
      'ritual': 'यज्ञ',
      'duty': 'धर्म',
      'dharma': 'धर्म',
      'righteousness': 'धर्म',
      'creator': 'ब्रह्म',
      'brahma': 'ब्रह्म',
      'supreme': 'ब्रह्म',
      'preserver': 'विष्णु',
      'vishnu': 'विष्णु',
      'protector': 'विष्णु',
      'destroyer': 'शिव',
      'shiva': 'शिव',
      'auspicious': 'शिव',
      'creation': 'सृष्टि',
      'नासदीय': '10.129',
      'पुरुष': '10.90',
    };

    // Try to find a Sanskrit term that hasn't been used before
    for (const [englishTerm, sanskritTerm] of Object.entries(termMappings)) {
      if (userQueryLower.includes(englishTerm) && !previousTerms.includes(sanskritTerm)) {
        return sanskritTerm;
      }
    }

    // Fallback: return a common RigVeda term that hasn't been used
    const commonTerms = ['अग्नि', 'इन्द्र', 'सोम', 'वरुण', 'उषस्', 'वायु', 'सूर्य', 'ऋत', 'यज्ञ', 'धर्म'];
    for (const term of commonTerms) {
      if (!previousTerms.includes(term)) {
        return term;
      }
    }

    // If all common terms have been used, return the first one
    return 'अग्नि';
  }
}
