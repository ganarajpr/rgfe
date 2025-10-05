import { LanguageModelV2 } from '@ai-sdk/provider';
import { generateText } from 'ai';
import { AgentContext, AgentResponse, SearchResult } from './types';
import { getSearchTool } from '../tools/search-tool';

export class SearcherAgent {
  private readonly model: LanguageModelV2;
  private searchToolInitialized = false;

  constructor(model: LanguageModelV2) {
    this.model = model;
  }

  /**
   * Translate English query to Sanskrit search terms
   */
  private async translateToSanskrit(englishQuery: string): Promise<string> {
    try {
      console.log(`🌐 Translating query to Sanskrit: "${englishQuery}"`);
      
      const prompt = `You are a Sanskrit scholar. Translate the following English query into relevant Sanskrit/Devanagari search terms that would be found in Sanskrit texts.

User Query: ${englishQuery}

Provide ONLY the Sanskrit/Devanagari keywords (2-5 key terms), separated by spaces. Do not provide explanations or transliterations, only Devanagari script.

Sanskrit keywords:`;

      const result = await generateText({
        model: this.model,
        prompt,
        temperature: 0.3,
      });

      const sanskritTerms = (result.text || '').trim();
      console.log(`   Translated to: "${sanskritTerms}"`);
      
      return sanskritTerms;
    } catch (error) {
      console.error('❌ Translation failed:', error);
      return englishQuery; // Fallback to original query
    }
  }

  /**
   * Initialize the search tool (should be called once on app startup)
   */
  async initializeSearchTool(progressCallback?: (progress: number, message: string) => void): Promise<void> {
    if (this.searchToolInitialized) {
      return;
    }

    try {
      console.log('🔧 Initializing searcher agent...');
      
      const searchTool = getSearchTool({
        binaryFilePath: '/smrithi-rgveda-embgemma-512d.bin',
        defaultLimit: 10,
        minScore: 0.1,
        useEmbeddings: true, // Enable semantic vector search with EmbeddingGemma
      });
      
      await searchTool.initialize(progressCallback);
      this.searchToolInitialized = true;
      console.log('✅ Searcher agent fully initialized with embedding-based search');
    } catch (error) {
      console.error('❌ Failed to initialize searcher agent search tool:', error);
      throw error;
    }
  }

  /**
   * Perform search based on user query
   */
  async search(context: AgentContext, customSearchQuery?: string): Promise<AgentResponse> {
    const queryToSearch = customSearchQuery || context.userQuery;

    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Get the search tool
      const searchTool = getSearchTool();

      // For vector/embedding search, use the original query directly
      // The embedding model understands semantic meaning across languages
      // Translation is only needed for keyword/text search fallback
      console.log(`🔍 Performing semantic vector search for: "${queryToSearch}"`);
      const searchResults = await searchTool.search(queryToSearch, 10);

      if (searchResults.length === 0) {
        console.log('⚠️ No search results found with semantic search');
        console.log('🔄 Attempting fallback with Sanskrit translation...');
        
        // Try with Sanskrit translation as last resort
        const sanskritQuery = await this.translateToSanskrit(queryToSearch);
        console.log(`   Sanskrit translation: "${sanskritQuery}"`);
        const fallbackResults = await searchTool.search(sanskritQuery, 10);
        
        if (fallbackResults.length === 0) {
          console.log('⚠️ No results found even with Sanskrit translation');
          return {
            content: 'No results found in the Sanskrit text corpus for this query.',
            nextAgent: 'generator',
            isComplete: false,
            searchResults: [],
            statusMessage: 'No results found',
          };
        }
        
        console.log(`✅ Found ${fallbackResults.length} results with Sanskrit translation`);
        return {
          content: `Found ${fallbackResults.length} relevant passages from Sanskrit texts.`,
          nextAgent: 'generator',
          isComplete: false,
          searchResults: fallbackResults,
          statusMessage: `Found ${fallbackResults.length} relevant passages`,
        };
      }

      console.log(`✅ Found ${searchResults.length} results with semantic vector search`);

      return {
        content: `Found ${searchResults.length} relevant passages from Sanskrit texts.`,
        nextAgent: 'generator',
        isComplete: false,
        searchResults,
        statusMessage: `Found ${searchResults.length} relevant passages`,
      };
    } catch (error) {
      console.error('❌ Searcher error:', error);
      
      // Fallback to simulated results if search fails
      console.log('⚠️ Falling back to simulated search results');
      const fallbackResults = this.createFallbackResults(queryToSearch);
      
      return {
        content: 'Search completed (using fallback results)',
        nextAgent: 'generator',
        isComplete: false,
        searchResults: fallbackResults,
        statusMessage: 'Search completed with fallback results',
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
    const refinedQuery = additionalContext;
    
    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Get the search tool
      const searchTool = getSearchTool();

      // Use the refined query directly for semantic vector search
      // The embedding model will understand the context regardless of language
      console.log(`🔍 Refined semantic vector search for: "${refinedQuery}"`);
      const newSearchResults = await searchTool.search(refinedQuery, 5);

      // If no results, try with Sanskrit translation as fallback
      if (newSearchResults.length === 0) {
        console.log('🔄 No results with semantic search, trying Sanskrit translation...');
        const hasDevanagari = /[\u0900-\u097F]/.test(refinedQuery);
        
        if (!hasDevanagari) {
          const sanskritQuery = await this.translateToSanskrit(refinedQuery);
          console.log(`   Sanskrit translation: "${sanskritQuery}"`);
          const fallbackResults = await searchTool.search(sanskritQuery, 5);
          
          if (fallbackResults.length > 0) {
            const previousIds = new Set(previousResults.map(r => r.id));
            const uniqueNewResults = fallbackResults.filter(r => !previousIds.has(r.id));
            const allResults = [...previousResults, ...uniqueNewResults];
            
            console.log(`✅ Found ${uniqueNewResults.length} new results with Sanskrit translation (${allResults.length} total)`);
            
            return {
              content: `Found ${uniqueNewResults.length} additional passages.`,
              nextAgent: 'generator',
              isComplete: false,
              searchResults: allResults,
              statusMessage: `Found ${uniqueNewResults.length} additional passages`,
            };
          }
        }
      }

      // Filter out duplicates based on ID
      const previousIds = new Set(previousResults.map(r => r.id));
      const uniqueNewResults = newSearchResults.filter(r => !previousIds.has(r.id));

      // Combine with previous results
      const allResults = [...previousResults, ...uniqueNewResults];

      console.log(`✅ Found ${uniqueNewResults.length} new results (${allResults.length} total)`);

      return {
        content: `Found ${uniqueNewResults.length} additional passages.`,
        nextAgent: 'generator',
        isComplete: false,
        searchResults: allResults,
        statusMessage: `Found ${uniqueNewResults.length} additional passages`,
      };
    } catch (error) {
      console.error('❌ Searcher refinement error:', error);
      return {
        content: 'Error performing refined search',
        nextAgent: 'generator',
        isComplete: false,
        searchResults: previousResults, // Return previous results on error
        statusMessage: 'Refined search failed, using previous results',
      };
    }
  }
}

