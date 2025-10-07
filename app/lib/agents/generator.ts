import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentContext, AgentResponse, SearchResult } from './types';

const GENERATOR_SYSTEM_PROMPT = `You are a Generator Agent specialized in creating comprehensive answers about the RigVeda.

CORPUS KNOWLEDGE - The RigVeda:
The search corpus contains verses from the RigVeda, the oldest of the four Vedas. It consists of:
- 10 Mandalas (books) with 1,028 hymns (Suktas) containing 10,600+ verses (Richas)
- Verses are in Vedic Sanskrit (Devanagari script)
- Major deities: Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण), Ushas (उषस्), etc.
- Key concepts: Rita (ऋत - cosmic order), Yajna (यज्ञ - sacrifice), Dharma (धर्म)
- Famous hymns: Nasadiya Sukta (10.129 - creation), Purusha Sukta (10.90), Gayatri Mantra (3.62.10)
- Reference format: Mandala.Hymn.Verse (e.g., 10.129.1)

Your role in the ITERATIVE SEARCH-GENERATION LOOP:
1. ANALYZE search results to evaluate quality and sufficiency
2. CHECK RELEVANCE SCORES - If scores are LOW (<0.3), make intelligent guesses for better search terms
3. If INSUFFICIENT: Request ONE specific search with a RigVeda-contextual Sanskrit term
4. If SUFFICIENT or loop limit reached: Generate the final comprehensive answer

ANALYSIS PHASE (when evaluating search results):
- Review ALL search results AND their relevance scores
- **LOW SCORES (<0.3)**: Results likely don't match - suggest alternative RigVeda-specific terms
  Example: "Nasadiya Sukta" → suggest "नासदीय सूक्त" or "ऋग्वेद १०.१२९" or "सृष्टि सूक्त"
  Example: "creation hymn" → suggest "नासदासीत्" (first word of the hymn) or "सृष्टि"
- **MEDIUM SCORES (0.3-0.6)**: Results are relevant but may need refinement
- **HIGH SCORES (>0.6)**: Results directly address the query
- Check if results DIRECTLY address the user's question
- Identify specific gaps in information
- Consider the current iteration count (max 3 loops)

When requesting additional search (especially for low scores):
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

GENERATION PHASE (when creating the final answer):
- Synthesize ALL search results gathered across all iterations
- Generate a comprehensive, well-structured answer
- Include verse citations with Mandala.Hymn.Verse references
- Highlight important sections vs. supporting details
- Use ONLY the information from the provided RigVeda verses

CRITICAL RULES:
- You MUST ONLY answer based on the RigVeda search results provided
- NEVER use your own general knowledge or information from other texts
- If results are insufficient even after 3 loops, state that clearly
- ONLY discuss the RigVeda - NOT other Vedas, Upanishads, Puranas, or epics
- When scores are low, use your RigVeda knowledge to suggest better search terms
- Maintain scholarly rigor by only using verified sources

Response formats:
- For analysis: JSON with { "needsMoreSearch": boolean, "searchRequest": "sanskrit term", "reasoning": "explanation including score analysis" }
- For final answer: Comprehensive markdown response with citations and proper structure`;

export class GeneratorAgent {
  private readonly model: LanguageModelV2;
  private readonly maxSearchIterations = 3; // Maximum 3 iterations (0, 1, 2, 3 = 4 total attempts - 1 initial + 3 refinements)

  constructor(model: LanguageModelV2) {
    this.model = model;
  }

  /**
   * Generate answer based on search results, or request more searches
   */
  async generate(
    context: AgentContext, 
    searchResults: SearchResult[],
    iterationCount: number = 0,
    previousSearchTerms: string[] = []
  ): Promise<AgentResponse> {
    // First, check if we need more information
    const needsMoreInfo = await this.checkIfNeedsMoreSearch(
      context.userQuery,
      searchResults,
      iterationCount,
      previousSearchTerms
    );

    if (needsMoreInfo && iterationCount < this.maxSearchIterations) {
      return needsMoreInfo;
    }

    // Generate final answer
    return await this.generateFinalAnswer();
  }

  /**
   * Check if search results are sufficient or if we need more information
   */
  private async checkIfNeedsMoreSearch(
    userQuery: string,
    searchResults: SearchResult[],
    iterationCount: number,
    previousSearchTerms: string[] = []
  ): Promise<AgentResponse | null> {
    if (iterationCount >= this.maxSearchIterations) {
      console.log(`⚠️ Max search iterations (${this.maxSearchIterations}) reached, proceeding with available results`);
      return null; // Max iterations reached, proceed with what we have
    }

    // Calculate average relevance score
    const avgScore = searchResults.length > 0 
      ? searchResults.reduce((sum, r) => sum + r.relevance, 0) / searchResults.length 
      : 0;
    const maxScore = searchResults.length > 0 
      ? Math.max(...searchResults.map(r => r.relevance))
      : 0;
    
    // Determine score quality labels
    const getScoreLabel = (score: number): string => {
      if (score < 0.3) return '❌ LOW - Results likely poor match';
      if (score < 0.6) return '⚠️ MEDIUM - Relevant but could be better';
      return '✅ HIGH - Strong match';
    };
    
    const getResultLabel = (score: number): string => {
      if (score < 0.3) return '❌ LOW';
      if (score < 0.6) return '⚠️ MEDIUM';
      return '✅ HIGH';
    };
    
    const analysisPrompt = `${GENERATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Current Iteration: ${iterationCount + 1} of ${this.maxSearchIterations + 1}

RELEVANCE SCORE ANALYSIS:
- Average Score: ${(avgScore * 100).toFixed(1)}% (${getScoreLabel(avgScore)})
- Highest Score: ${(maxScore * 100).toFixed(1)}%
- Total Results: ${searchResults.length}

Available Search Results (gathered so far):
${searchResults.map((r, i) => `
${i + 1}. ${r.title}
   Relevance: ${(r.relevance * 100).toFixed(1)}% ${getResultLabel(r.relevance)}
   Text: ${r.content?.substring(0, 200)}...
   Source: ${r.source || 'RigVeda'}
`).join('\n')}

TASK: Analyze if these search results provide sufficient information to answer the user's query comprehensively.

PREVIOUS SEARCH TERMS USED (DO NOT REPEAT THESE):
${previousSearchTerms.length > 0 ? previousSearchTerms.map((term, i) => `${i + 1}. "${term}"`).join('\n') : 'None (this is the first search)'}

CRITICAL SCORING GUIDANCE:
- If average score < 0.3: Results are likely NOT relevant. Make an INTELLIGENT GUESS for a better RigVeda-specific search term
  * Think: What Sanskrit term, deity name, or Mandala reference would a RigVeda scholar use?
  * Example: "Nasadiya Sukta" → try "नासदीय" or "सृष्टि सूक्त" or "मण्डल १०"
- If scores are decent but content doesn't answer the question: Request specific missing aspect
- If scores are good and content is relevant: Proceed with answer generation

IMPORTANT: 
- This is internal analysis - NOT shown to user
- You have ${this.maxSearchIterations - iterationCount} more search opportunities
- Be strategic: use RigVeda knowledge to make smart search term suggestions
- Focus on Sanskrit terms that would actually appear in the RigVeda corpus
- **CRITICAL: DO NOT suggest search terms that were already used** (see list above)
- **CRITICAL: Generate a COMPLETELY DIFFERENT search term from previous attempts**
- Make sure your searchRequest uses VALID UTF-8 Devanagari characters
- Use Devanagari numerals carefully: १ (1), २ (2), ३ (3), ४ (4), ५ (5), ६ (6), ७ (7), ८ (8), ९ (9), ० (0)
- If referencing Mandala numbers, you can use either: "मण्डल 10" or "मण्डल १०" (both valid)
- Avoid mixing scripts unnecessarily - keep search terms focused
- Be creative: try alternative Sanskrit synonyms, different deity names, or conceptual terms

Output ONLY a JSON object:
{
  "needsMoreSearch": boolean,
  "searchRequest": "ONE NEW focused Sanskrit/Devanagari search term not in the list above",
  "reasoning": "brief explanation including score analysis and what you're looking for"
}`;

    try {
      const result = streamText({
        model: this.model,
        prompt: analysisPrompt,
        temperature: 0.3,
      });

      let fullResponse = '';
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
      }

      console.log('🤖 Generator analysis:', fullResponse.substring(0, 200));

      // Parse analysis
      let analysis;
      try {
        const jsonRegex = /\{[\s\S]*\}/;
        const jsonMatch = jsonRegex.exec(fullResponse);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          console.log('⚠️ Could not parse analysis JSON, proceeding with generation');
          return null; // Can't parse, proceed with generation
        }
      } catch (parseError) {
        console.log('⚠️ JSON parse error, proceeding with generation:', parseError);
        return null;
      }

      // Check if more search is needed
      if (analysis.needsMoreSearch && analysis.searchRequest && iterationCount < this.maxSearchIterations) {
        // Ensure the search request contains Devanagari script
        const hasDevanagari = /[\u0900-\u097F]/.test(analysis.searchRequest);
        
        if (hasDevanagari) {
          // Clean the search request to ensure proper UTF-8
          const cleanedSearchRequest = analysis.searchRequest.trim();
          
          console.log(`🔄 Requesting additional search: "${cleanedSearchRequest}"`);
          console.log(`   Reasoning: ${analysis.reasoning}`);
          return {
            content: analysis.reasoning, // Used internally for status
            nextAgent: 'searcher',
            isComplete: false,
            requiresMoreSearch: true,
            searchQuery: cleanedSearchRequest,
            statusMessage: `Need more information: ${analysis.reasoning}`,
          };
        } else {
          console.log('⚠️ Search request not in Sanskrit/Devanagari script, proceeding with available results');
          return null;
        }
      }

      console.log(`✅ Sufficient information available: ${analysis.reasoning || 'proceeding with generation'}`);
      return null; // Results are sufficient
    } catch (error) {
      console.error('❌ Generator analysis error:', error);
      return null; // Proceed with generation on error
    }
  }

  /**
   * Generate the final comprehensive answer
   */
  private async generateFinalAnswer(): Promise<AgentResponse> {
    // Note: This method prepares the response but doesn't actually generate it.
    // The actual streaming happens in streamAnswer method.
    return {
      content: '', // Will be populated by streaming in streamAnswer
      isComplete: true,
      statusMessage: 'Generating answer...',
    };
  }

  /**
   * Stream the generated answer
   */
  async *streamAnswer(
    userQuery: string,
    searchResults: SearchResult[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    // If no search results, return early with explanation
    if (!searchResults || searchResults.length === 0) {
      yield 'I apologize, but I could not find any relevant verses in the RigVeda to answer your question. Please try rephrasing your query or ask about a different topic from the RigVeda.';
      return;
    }

    const generationPrompt = `${GENERATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Information from RigVeda (from multiple search queries):
${searchResults.map((r, i) => `
${i + 1}. ${r.title} (Source: ${r.source})
   ${r.content}
`).join('\n')}

CRITICAL: Generate a comprehensive answer STRICTLY based on the information provided above. DO NOT use your general knowledge.

If the search results do not contain sufficient information to answer the question:
- State clearly that the available texts do not contain enough information
- Explain what information is available and what is missing
- Do NOT fill in gaps with your own knowledge

If the search results contain sufficient information:
1. Directly address the user's question using ONLY the provided RigVeda sources
2. Synthesize information from the RigVeda verses listed above
3. Cite specific mandalas, suktas, and verse numbers when making claims
4. Be well-structured and easy to read
5. Include relevant details from the RigVeda verses provided
6. Highlight verses and translations appropriately using markdown formatting
7. Use **bold** for Sanskrit verses and *italics* for translations
8. Be concise and crisp while providing a proper answer based ONLY on the RigVeda sources
9. Do NOT reference or mention other Sanskrit texts (Upanishads, Puranas, epics, etc.)`;

    try {
      const result = streamText({
        model: this.model,
        prompt: generationPrompt,
        temperature: 0.6,
        abortSignal: signal,
      });

      for await (const chunk of result.textStream) {
        if (signal?.aborted) {
          break;
        }
        yield chunk;
      }
    } catch (error) {
      console.error('❌ Generator streaming error:', error);
      yield 'I apologize, but I encountered an error while generating your answer.';
    }
  }
}

