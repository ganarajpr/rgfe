import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentContext, AgentResponse, SearchResult } from './types';

const GENERATOR_SYSTEM_PROMPT = `You are a Generator Agent specialized in creating comprehensive answers about the RigVeda.

Your role is to:
1. Review ALL search results provided to you from multiple search queries
2. Determine if the COMPLETE set of search results contains sufficient information to answer the user's query
3. If insufficient, request additional search with specific refinement queries IN SANSKRIT/DEVANAGARI
4. If sufficient, generate a comprehensive, well-structured answer with proper verse highlighting

When analyzing search results:
- Review the COMPLETE list of results from all search queries
- Check if they directly address the user's question
- Identify any gaps in information
- Determine if you need more specific or additional context
- Consider if the verses and translations are sufficient for a complete answer

CRITICAL RULES: 
- When requesting additional search, you MUST provide search terms in Sanskrit/Devanagari script (देवनागरी)
- You MUST ONLY answer based on the RigVeda search results provided
- NEVER use your own general knowledge or information from other Sanskrit texts
- If search results do NOT contain sufficient information to answer the question, you should state that clearly
- Comment on the currently returned verses and explain why they are insufficient
- ONLY discuss the RigVeda - do NOT reference other Vedas, Upanishads, Puranas, or epics

Response format:
- If need more search: Output JSON with { "needsMoreSearch": true, "searchQuery": "sanskrit terms in devanagari", "reasoning": "why" }
- If ready to answer: Generate a detailed, accurate response ONLY from the provided search results
- If insufficient info: State clearly that the available verses do not contain enough information to answer the question

Your answers should:
- Be STRICTLY based on the provided RigVeda search results
- Include verses and translations with proper highlighting
- Cite specific mandalas, suktas, and verse numbers when possible
- Be comprehensive yet clear
- NEVER include information not found in the search results
- NEVER reference other Sanskrit texts (Upanishads, Mahabharata, etc.)
- Maintain scholarly rigor by only using verified sources from the RigVeda`;

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
    iterationCount: number = 0
  ): Promise<AgentResponse> {
    // First, check if we need more information
    const needsMoreInfo = await this.checkIfNeedsMoreSearch(
      context.userQuery,
      searchResults,
      iterationCount
    );

    if (needsMoreInfo && iterationCount < this.maxSearchIterations) {
      return needsMoreInfo;
    }

    // Generate final answer
    return await this.generateFinalAnswer(context.userQuery, searchResults);
  }

  /**
   * Check if search results are sufficient or if we need more information
   */
  private async checkIfNeedsMoreSearch(
    userQuery: string,
    searchResults: SearchResult[],
    iterationCount: number
  ): Promise<AgentResponse | null> {
    if (iterationCount >= this.maxSearchIterations) {
      console.log(`⚠️ Max search iterations (${this.maxSearchIterations}) reached, proceeding with available results`);
      return null; // Max iterations reached, proceed with what we have
    }

    const analysisPrompt = `${GENERATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Search Results (from multiple search queries):
${searchResults.map((r, i) => `
${i + 1}. ${r.title} (relevance: ${r.relevance})
   ${r.content}
   Source: ${r.source}
`).join('\n')}

Analyze if these search results provide sufficient information to comprehensively answer the user's query.

IMPORTANT: Your response will NOT be shown to the user - this is internal analysis only.

Output ONLY a JSON object:
{
  "needsMoreSearch": boolean,
  "searchQuery": "specific refined Sanskrit/Devanagari query if needed (देवनागरी में)",
  "reasoning": "explanation of what's missing or why results are sufficient",
  "hasSufficientInfo": boolean,
  "canAnswerQuestion": boolean
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

      console.log('🤖 Generator analysis response:', fullResponse);

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

      // Check if we can answer the question with current results
      if (analysis.canAnswerQuestion === false || analysis.hasSufficientInfo === false) {
        console.log('❌ Insufficient information to answer question');
        // Don't request more search, just proceed with generation which will explain insufficiency
        return null;
      }

      // Only request more search if explicitly needed AND we have a Sanskrit query AND haven't reached max iterations
      if (analysis.needsMoreSearch && analysis.searchQuery && iterationCount < this.maxSearchIterations) {
        // Ensure the search query contains Devanagari script
        const hasDevanagari = /[\u0900-\u097F]/.test(analysis.searchQuery);
        if (hasDevanagari) {
          console.log(`🔄 Requesting additional search: "${analysis.searchQuery}"`);
          return {
            content: '', // Internal only, not shown to user
            nextAgent: 'searcher',
            isComplete: false,
            requiresMoreSearch: true,
            searchQuery: analysis.searchQuery,
            statusMessage: `Searching for additional context: "${analysis.searchQuery}"`,
          };
        } else {
          console.log('⚠️ Search query not in Sanskrit, proceeding with available results');
          return null;
        }
      }

      return null; // Results are sufficient
    } catch (error) {
      console.error('❌ Generator analysis error:', error);
      return null; // Proceed with generation on error
    }
  }

  /**
   * Generate the final comprehensive answer
   */
  private async generateFinalAnswer(
    userQuery: string,
    searchResults: SearchResult[]
  ): Promise<AgentResponse> {
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
    searchResults: SearchResult[]
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
      });

      for await (const chunk of result.textStream) {
        yield chunk;
      }
    } catch (error) {
      console.error('❌ Generator streaming error:', error);
      yield 'I apologize, but I encountered an error while generating your answer.';
    }
  }
}

