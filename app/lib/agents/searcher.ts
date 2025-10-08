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
   * Translate English query to Sanskrit search terms with RigVeda context
   */
  private async translateToSanskrit(englishQuery: string): Promise<string> {
    try {
      console.log(`🌐 Translating query to Sanskrit: "${englishQuery}"`);
      
      const prompt = `You are a RigVeda scholar. Translate the following query into Sanskrit/Devanagari search terms that would be found in the RigVeda corpus.

RIGVEDA CONTEXT:
- Corpus contains 10 Mandalas with hymns to deities like Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण)
- Key concepts: Rita (ऋत), Yajna (यज्ञ), Dharma (धर्म)
- Famous hymns: Nasadiya Sukta (नासदीय सूक्त), Purusha Sukta (पुरुष सूक्त)
- Written in Vedic Sanskrit/Devanagari script

User Query: ${englishQuery}

Generate 2-5 relevant Sanskrit/Devanagari keywords that would help find this topic in the RigVeda.
Think: What Sanskrit terms would actually appear in RigVeda verses?

Provide ONLY the Sanskrit/Devanagari keywords separated by spaces. No explanations, only Devanagari script.

Sanskrit keywords:`;

      const result = await generateText({
        model: this.model,
        prompt,
        temperature: 0.3,
      });

      let sanskritTerms = (result.text || '').trim();
      sanskritTerms = this.sanitizeUnicode(sanskritTerms);
      console.log(`   Translated to: "${sanskritTerms}"`);
      
      return sanskritTerms;
    } catch (error) {
      console.error('❌ Translation failed:', error);
      return englishQuery; // Fallback to original query
    }
  }

  /**
   * Sanitize Unicode text to remove malformed characters
   */
  private sanitizeUnicode(text: string): string {
    if (!text) return text;

    // Remove malformed Devanagari sequences (characters followed by question marks or garbled text)
    let sanitized = text.replace(/[\u0900-\u097F]+[?]+/g, ''); // Remove Devanagari followed by question marks
    sanitized = sanitized.replace(/[?]+[\u0900-\u097F]+/g, ''); // Remove question marks followed by Devanagari
    
    // Clean up multiple spaces and normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
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
        minScore: 0.0, // Use 0.0 like cli-search.js for cosine similarity
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
   * Generate a single focused search term/phrase IN SANSKRIT based on the request
   * This is called by the orchestrator with specific search context
   */
  private async generateSearchTerm(searchRequest: string, previousSearchTerms: string[] = []): Promise<string> {
    try {
      console.log(`🧠 Generating Sanskrit search term for: "${searchRequest}"`);
      
      const prompt = `You are a RigVeda scholar and expert. For the given search request, generate ONE focused search term or phrase IN SANSKRIT/DEVANAGARI SCRIPT that would help find relevant information in the RigVeda corpus.

RIGVEDA CORPUS KNOWLEDGE:
- 10 Mandalas (books) containing hymns to various deities
- Major deities: Agni (अग्नि - fire), Indra (इन्द्र - thunder), Soma (सोम - sacred plant), Varuna (वरुण - cosmic order), Ushas (उषस् - dawn)
- Key concepts: Rita (ऋत - cosmic order), Yajna (यज्ञ - sacrifice), Brahman (ब्रह्मन्), Atman (आत्मन्)
- Famous hymns: Nasadiya/Nasadiya Sukta (नासदीय सूक्त - creation hymn in Mandala 10.129), Purusha Sukta (पुरुष सूक्त - cosmic being)
- Written in Vedic Sanskrit with Devanagari script

Search Request: ${searchRequest}

PREVIOUS SEARCH TERMS USED (DO NOT REPEAT THESE):
${previousSearchTerms.length > 0 ? previousSearchTerms.map((term, i) => `${i + 1}. "${term}"`).join('\n') : 'None (this is the first search)'}

THINK: What Sanskrit term, deity name, concept, or phrase would ACTUALLY appear in RigVeda verses for this topic?
- For deity names: Use Sanskrit (e.g., "Agni" → "अग्नि")
- For concepts: Use Vedic Sanskrit terms (e.g., "cosmic order" → "ऋत")
- For famous hymns: Use Sanskrit name or key phrase (e.g., "Nasadiya" → "नासदीय" or "नासदासीत्")
- For rituals: Use Sanskrit ritual terms (e.g., "sacrifice" → "यज्ञ")

CRITICAL: Generate a NEW search term that is NOT in the list above. Be creative and think of alternative Sanskrit terms that would find different results.

Generate ONE focused Sanskrit/Devanagari search term that would find this in the RigVeda.
Return ONLY the Sanskrit search term in Devanagari script, without explanations or formatting.

Sanskrit search term:`;

      const result = await generateText({
        model: this.model,
        prompt,
        temperature: 0.3,
      });

      let searchTerm = (result.text || '').trim();

      // Sanitize malformed Unicode characters
      searchTerm = this.sanitizeUnicode(searchTerm);

      // Check if we got Devanagari script
      if (searchTerm && /[\u0900-\u097F]/.test(searchTerm)) {
        console.log(`   Generated Sanskrit search term: "${searchTerm}"`);
        return searchTerm;
      } else {
        console.log('   No Sanskrit term generated, attempting translation...');
        const sanskritQuery = await this.translateToSanskrit(searchRequest);
        return this.sanitizeUnicode(sanskritQuery);
      }
    } catch (error) {
      console.error('❌ Failed to generate search term:', error);
      // Try to translate as fallback
      const sanskritQuery = await this.translateToSanskrit(searchRequest);
      return this.sanitizeUnicode(sanskritQuery);
    }
  }

  /**
   * Perform a single focused search based on the search request
   * The orchestrator provides what should be searched
   */
  async search(context: AgentContext, signal?: AbortSignal, searchRequest?: string): Promise<AgentResponse> {
    const requestToSearch = searchRequest || context.userQuery;

    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Generate single focused search term
      const searchTerm = await this.generateSearchTerm(requestToSearch, []);
      
      // Get the search tool
      const searchTool = getSearchTool();
      
      console.log(`🔍 Performing search with term: "${searchTerm}"`);
      
      // Notify coordinator about search
      if (this.coordinatorCallback) {
        this.coordinatorCallback(`Searching: "${searchTerm}"`);
      }

      let searchResults: SearchResult[] = [];
      try {
        searchResults = await searchTool.search(searchTerm, 10);
        console.log(`   ✅ Found ${searchResults.length} results`);
      } catch (error) {
        console.error(`   ❌ Search failed for term "${searchTerm}":`, error);
      }

      // Log search results
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 SEARCH RESULTS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Search term: "${searchTerm}"`);
      console.log(`Results found: ${searchResults.length}`);
      if (searchResults.length > 0) {
        console.log('Top results:');
        searchResults.slice(0, 3).forEach((result, i) => {
          console.log(`  ${i + 1}. [${result.relevance.toFixed(3)}] ${result.title}`);
        });
      }
      console.log('═══════════════════════════════════════════════════════════\n');

      if (searchResults.length === 0) {
        console.log('⚠️ No search results found');
        return {
          content: 'No results found in the RigVeda corpus for this search.',
          nextAgent: 'generator',
          isComplete: false,
          searchResults: [],
          statusMessage: 'No results found',
        };
      }

      return {
        content: `Found ${searchResults.length} relevant verses from the RigVeda.`,
        nextAgent: 'generator',
        isComplete: false,
        searchResults: searchResults,
        statusMessage: `Found ${searchResults.length} relevant verses`,
      };
    } catch (error) {
      console.error('❌ Searcher error:', error);
      
      // Fallback to simulated results if search fails
      console.log('⚠️ Falling back to simulated search results');
      const fallbackResults = this.createFallbackResults(requestToSearch);
      
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
   * Perform additional search with new context from generator
   * This is called when the generator determines it needs more information
   */
  async searchWithContext(
    searchRequest: string,
    previousResults: SearchResult[],
    previousSearchTerms: string[] = []
  ): Promise<AgentResponse> {
    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Generate focused search term for this request
      const searchTerm = await this.generateSearchTerm(searchRequest, previousSearchTerms);
      
      // Get the search tool
      const searchTool = getSearchTool();

      console.log(`🔍 Additional search with term: "${searchTerm}"`);
      
      // Notify coordinator
      if (this.coordinatorCallback) {
        this.coordinatorCallback(`Additional search: "${searchTerm}"`);
      }

      let newSearchResults: SearchResult[] = [];
      try {
        newSearchResults = await searchTool.search(searchTerm, 8);
        console.log(`   ✅ Found ${newSearchResults.length} results`);
      } catch (error) {
        console.error(`   ❌ Search failed for term "${searchTerm}":`, error);
      }

      // Filter out duplicates based on ID
      const previousIds = new Set(previousResults.map(r => r.id));
      const uniqueNewResults = newSearchResults.filter(r => !previousIds.has(r.id));

      // Combine with previous results
      const allResults = [...previousResults, ...uniqueNewResults];

      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 ADDITIONAL SEARCH RESULTS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Search term: "${searchTerm}"`);
      console.log(`New results: ${uniqueNewResults.length}`);
      console.log(`Total results: ${allResults.length}`);
      console.log('═══════════════════════════════════════════════════════════\n');

      return {
        content: `Found ${uniqueNewResults.length} additional verses from the RigVeda.`,
        nextAgent: 'generator',
        isComplete: false,
        searchResults: allResults,
        statusMessage: `Found ${uniqueNewResults.length} new verses (${allResults.length} total)`,
      };
    } catch (error) {
      console.error('❌ Searcher additional search error:', error);
      return {
        content: 'Error performing additional search',
        nextAgent: 'generator',
        isComplete: false,
        searchResults: previousResults, // Return previous results on error
        statusMessage: 'Additional search failed, using previous results',
      };
    }
  }
}

