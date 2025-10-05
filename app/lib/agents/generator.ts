import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentContext, AgentResponse, SearchResult } from './types';

const GENERATOR_SYSTEM_PROMPT = `You are a Generator Agent specialized in creating comprehensive answers about Sanskrit literature.

Your role is to:
1. Analyze search results provided to you
2. Determine if the search results are sufficient to answer the user's query
3. If insufficient, request additional search with specific refinement queries IN SANSKRIT/DEVANAGARI
4. If sufficient, generate a comprehensive, well-structured answer

When analyzing search results:
- Check if they directly address the user's question
- Identify any gaps in information
- Determine if you need more specific or additional context

IMPORTANT: When requesting additional search, you MUST provide search terms in Sanskrit/Devanagari script because the search index contains Sanskrit text. Translate English concepts to Sanskrit terms.

Response format:
- If need more search: Output JSON with { "needsMoreSearch": true, "searchQuery": "sanskrit terms in devanagari", "reasoning": "why" }
- If ready to answer: Generate a detailed, accurate response citing the search results

Your answers should:
- Be accurate and well-sourced
- Cite specific texts or sources when possible
- Be comprehensive yet clear
- Maintain scholarly rigor`;

export class GeneratorAgent {
  private readonly model: LanguageModelV2;
  private readonly maxSearchIterations = 2; // Prevent infinite loops

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
      return null; // Max iterations reached, proceed with what we have
    }

    const analysisPrompt = `${GENERATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Search Results:
${searchResults.map((r, i) => `
${i + 1}. ${r.title} (relevance: ${r.relevance})
   ${r.content}
   Source: ${r.source}
`).join('\n')}

Analyze if these search results provide sufficient information to comprehensively answer the user's query.

Output ONLY a JSON object:
{
  "needsMoreSearch": boolean,
  "searchQuery": "specific refined query if needed",
  "reasoning": "explanation of what's missing or why results are sufficient"
}`;

    try {
      const result = await streamText({
        model: this.model,
        prompt: analysisPrompt,
        temperature: 0.3,
      });

      let fullResponse = '';
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
      }

      // Parse analysis
      let analysis;
      try {
        const jsonRegex = /\{[\s\S]*\}/;
        const jsonMatch = jsonRegex.exec(fullResponse);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          return null; // Can't parse, proceed with generation
        }
      } catch {
        return null;
      }

      if (analysis.needsMoreSearch && analysis.searchQuery) {
        return {
          content: `I need more specific information to fully answer your question. Searching for: "${analysis.searchQuery}"`,
          nextAgent: 'searcher',
          isComplete: false,
          requiresMoreSearch: true,
          searchQuery: analysis.searchQuery,
          statusMessage: `Requesting additional search: "${analysis.searchQuery}"`,
        };
      }

      return null; // Results are sufficient
    } catch (error) {
      console.error('Generator analysis error:', error);
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
    const generationPrompt = `${GENERATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Information:
${searchResults.map((r, i) => `
${i + 1}. ${r.title} (Source: ${r.source})
   ${r.content}
`).join('\n')}

Now generate a comprehensive answer to the user's query based on these sources.

Your answer should:
1. Directly address the user's question
2. Synthesize information from multiple sources
3. Cite specific sources when making claims
4. Be well-structured and easy to read
5. Include relevant details from Sanskrit texts when applicable

Generate your answer now:`;

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
    const generationPrompt = `${GENERATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Information:
${searchResults.map((r, i) => `
${i + 1}. ${r.title} (Source: ${r.source})
   ${r.content}
`).join('\n')}

Generate a comprehensive answer to the user's query based on these sources.`;

    try {
      const result = await streamText({
        model: this.model,
        prompt: generationPrompt,
        temperature: 0.6,
      });

      for await (const chunk of result.textStream) {
        yield chunk;
      }
    } catch (error) {
      console.error('Generator streaming error:', error);
      yield 'I apologize, but I encountered an error while generating your answer.';
    }
  }
}

