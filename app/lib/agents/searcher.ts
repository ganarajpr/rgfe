import { LanguageModelV2 } from '@ai-sdk/provider';
import { generateText } from 'ai';
import { AgentContext, AgentResponse, SearchResult } from './types';
import { getSearchTool } from '../tools/search-tool';

export class SearcherAgent {
  private readonly model: LanguageModelV2;
  private searchToolInitialized = false;
  private coordinatorCallback?: (message: string) => void;

  constructor(model: LanguageModelV2) {
    this.model = model;
  }

  /**
   * Set callback for coordinator notifications
   */
  setCoordinatorCallback(callback: (message: string) => void): void {
    this.coordinatorCallback = callback;
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
   * Generate multiple search terms/phrases for comprehensive search IN SANSKRIT
   */
  private async generateSearchTerms(userQuery: string): Promise<string[]> {
    try {
      console.log(`🧠 Generating multiple Sanskrit search terms for: "${userQuery}"`);
      
      const prompt = `You are a Sanskrit literature expert. For the given user query, generate 2-3 different search terms or phrases IN SANSKRIT/DEVANAGARI SCRIPT that would help find comprehensive information about the topic in Sanskrit texts.

User Query: ${userQuery}

IMPORTANT: 
- Generate ALL search terms in Sanskrit/Devanagari script (देवनागरी)
- DO NOT use English or transliteration
- Focus on key Sanskrit terms that would appear in classical texts

Generate 2-3 different search approaches in Sanskrit:
1. Direct Sanskrit term for the main concept
2. Alternative Sanskrit phrase or related concept
3. Specific Sanskrit aspect or detail (if applicable)

Return ONLY the Sanskrit search terms in Devanagari script, one per line, without explanations or numbering.

Sanskrit search terms:`;

      const result = await generateText({
        model: this.model,
        prompt,
        temperature: 0.4,
      });

      const searchTerms = (result.text || '')
        .split('\n')
        .map(term => term.trim())
        .filter(term => term.length > 0 && /[\u0900-\u097F]/.test(term)) // Only keep terms with Devanagari
        .slice(0, 3); // Limit to 3 terms

      // If we got Sanskrit terms, use them; otherwise translate the query
      if (searchTerms.length > 0) {
        console.log(`   Generated ${searchTerms.length} Sanskrit search terms:`);
        searchTerms.forEach((term, i) => {
          console.log(`   ${i + 1}. "${term}"`);
        });
        return searchTerms;
      } else {
        console.log('   No Sanskrit terms generated, attempting translation...');
        const sanskritQuery = await this.translateToSanskrit(userQuery);
        return [sanskritQuery];
      }
    } catch (error) {
      console.error('❌ Failed to generate search terms:', error);
      // Try to translate as fallback
      const sanskritQuery = await this.translateToSanskrit(userQuery);
      return [sanskritQuery];
    }
  }

  /**
   * Perform search based on user query with multiple search terms
   */
  async search(context: AgentContext, customSearchQuery?: string): Promise<AgentResponse> {
    const queryToSearch = customSearchQuery || context.userQuery;

    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Generate multiple search terms
      const searchTerms = await this.generateSearchTerms(queryToSearch);
      
      // Get the search tool
      const searchTool = getSearchTool();
      
      // Perform searches with each term
      const allSearchResults: SearchResult[] = [];
      const searchTermResults: { term: string; results: SearchResult[] }[] = [];

      for (let i = 0; i < searchTerms.length; i++) {
        const searchTerm = searchTerms[i];
        
        console.log(`🔍 Search ${i + 1}/${searchTerms.length}: "${searchTerm}"`);
        
        // Notify coordinator about current search
        if (this.coordinatorCallback) {
          this.coordinatorCallback(`Searching: "${searchTerm}" (${i + 1}/${searchTerms.length})`);
        }

        try {
          const searchResults = await searchTool.search(searchTerm, 8);
          
          console.log(`   ✅ Found ${searchResults.length} results`);
          
          // Store results for this term
          searchTermResults.push({
            term: searchTerm,
            results: searchResults
          });
          
          // Add unique results to combined list
          const existingIds = new Set(allSearchResults.map(r => r.id));
          const uniqueResults = searchResults.filter(r => !existingIds.has(r.id));
          allSearchResults.push(...uniqueResults);
          
        } catch (error) {
          console.error(`   ❌ Search failed for term "${searchTerm}":`, error);
        }
      }

      // Log comprehensive results
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 COMPREHENSIVE SEARCH RESULTS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Total unique results: ${allSearchResults.length}`);
      searchTermResults.forEach((termResult, i) => {
        console.log(`Term ${i + 1}: "${termResult.term}" → ${termResult.results.length} results`);
      });
      console.log('═══════════════════════════════════════════════════════════\n');

      if (allSearchResults.length === 0) {
        console.log('⚠️ No search results found with any search term');
        return {
          content: 'No results found in the Sanskrit text corpus for this query.',
          nextAgent: 'generator',
          isComplete: false,
          searchResults: [],
          statusMessage: 'No results found',
        };
      }

      return {
        content: `Found ${allSearchResults.length} relevant passages from Sanskrit texts using ${searchTerms.length} different search approaches.`,
        nextAgent: 'generator',
        isComplete: false,
        searchResults: allSearchResults,
        statusMessage: `Found ${allSearchResults.length} relevant passages`,
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

