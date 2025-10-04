import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentContext, AgentResponse, SearchResult } from './types';

const SEARCHER_SYSTEM_PROMPT = `You are a Searcher Agent specialized in finding relevant information about Sanskrit literature.

Your role is to:
1. Analyze the user's query to understand what information they need
2. Generate relevant search queries to find information
3. Simulate searching through a knowledge base of Sanskrit texts and literature
4. Return the most relevant results

For this simulation, you will generate realistic search results based on your knowledge of Sanskrit literature.
Each search result should include:
- Title (name of the text or topic)
- Content (relevant excerpt or summary)
- Relevance score (0-1)

Generate 3-5 high-quality search results that would help answer the user's query.
Output as JSON array of search results.`;

export class SearcherAgent {
  private readonly model: LanguageModelV2;

  constructor(model: LanguageModelV2) {
    this.model = model;
  }

  /**
   * Perform search based on user query
   */
  async search(context: AgentContext, customSearchQuery?: string): Promise<AgentResponse> {
    const queryToSearch = customSearchQuery || context.userQuery;

    const searchPrompt = `${SEARCHER_SYSTEM_PROMPT}

User Query: ${queryToSearch}

Generate 3-5 relevant search results from Sanskrit literature that would help answer this query.
Output ONLY a JSON array with this structure:
[
  {
    "id": "unique-id",
    "title": "Source Title",
    "content": "Relevant excerpt or information",
    "relevance": 0.95,
    "source": "Text name"
  }
]

Be specific and accurate. Include actual Sanskrit texts, concepts, or teachings when relevant.`;

    try {
      const result = await streamText({
        model: this.model,
        prompt: searchPrompt,
        temperature: 0.4,
      });

      let fullResponse = '';
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
      }

      // Parse search results
      let searchResults: SearchResult[] = [];
      try {
        // Extract JSON array from response
        const jsonRegex = /\[[\s\S]*\]/;
        const jsonMatch = jsonRegex.exec(fullResponse);
        if (jsonMatch) {
          searchResults = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: create a basic result
          searchResults = this.createFallbackResults(queryToSearch);
        }
      } catch {
        searchResults = this.createFallbackResults(queryToSearch);
      }

      // Ensure results have proper structure
      searchResults = searchResults.map((result, index) => ({
        id: result.id || `result-${Date.now()}-${index}`,
        title: result.title || 'Sanskrit Text Reference',
        content: result.content || 'Relevant information from Sanskrit literature',
        relevance: result.relevance || 0.8,
        source: result.source || 'Sanskrit Literature',
      }));

      return {
        content: `Found ${searchResults.length} relevant sources from Sanskrit literature.`,
        nextAgent: 'generator',
        isComplete: false,
        searchResults,
        statusMessage: `✅ Found ${searchResults.length} relevant sources`,
      };
    } catch (error) {
      console.error('Searcher error:', error);
      return {
        content: 'Error performing search',
        isComplete: true,
        searchResults: this.createFallbackResults(queryToSearch),
      };
    }
  }

  /**
   * Create fallback results if LLM fails to generate proper JSON
   */
  private createFallbackResults(query: string): SearchResult[] {
    return [
      {
        id: `fallback-${Date.now()}-1`,
        title: 'Sanskrit Literature Reference',
        content: `Information related to: ${query}. This is a fallback result as the search system encountered an issue.`,
        relevance: 0.7,
        source: 'Sanskrit Knowledge Base',
      },
      {
        id: `fallback-${Date.now()}-2`,
        title: 'Classical Text Reference',
        content: 'Relevant passages and teachings from classical Sanskrit texts.',
        relevance: 0.6,
        source: 'Sanskrit Texts',
      },
    ];
  }

  /**
   * Perform refined search with additional context
   */
  async refineSearch(
    context: AgentContext, 
    additionalContext: string,
    previousResults: SearchResult[]
  ): Promise<AgentResponse> {
    const refinedQuery = `${context.userQuery}\n\nAdditional context: ${additionalContext}`;
    
    // Mention previous results to avoid duplication
    const searchPrompt = `${SEARCHER_SYSTEM_PROMPT}

User Query: ${refinedQuery}

Previous search results found:
${previousResults.map(r => `- ${r.title}`).join('\n')}

Generate 2-3 NEW search results that provide additional information not covered in previous results.
Output ONLY a JSON array with the same structure as before.`;

    try {
      const result = await streamText({
        model: this.model,
        prompt: searchPrompt,
        temperature: 0.4,
      });

      let fullResponse = '';
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
      }

      let searchResults: SearchResult[] = [];
      try {
        const jsonRegex = /\[[\s\S]*\]/;
        const jsonMatch = jsonRegex.exec(fullResponse);
        if (jsonMatch) {
          searchResults = JSON.parse(jsonMatch[0]);
        } else {
          searchResults = this.createFallbackResults(refinedQuery);
        }
      } catch {
        searchResults = this.createFallbackResults(refinedQuery);
      }

      // Combine with previous results
      const allResults = [...previousResults, ...searchResults];

      return {
        content: `Found ${searchResults.length} additional sources.`,
        nextAgent: 'generator',
        isComplete: false,
        searchResults: allResults,
        statusMessage: `✅ Found ${searchResults.length} additional sources`,
      };
    } catch (error) {
      console.error('Searcher refinement error:', error);
      return {
        content: 'Error performing refined search',
        nextAgent: 'generator',
        isComplete: false,
        searchResults: previousResults, // Return previous results on error
      };
    }
  }
}

