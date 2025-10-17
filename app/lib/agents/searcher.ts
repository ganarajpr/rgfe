import { LanguageModelV2 } from '@ai-sdk/provider';
import { generateText } from 'ai';
import { AgentResponse, SearchResult } from './types';
import { getSearchTool } from '../tools/search-tool';
import { getSearchEngine } from '../search-engine';

export class SearcherAgent {
  private readonly model: LanguageModelV2;
  private searchToolInitialized = false;
  private coordinatorCallback?: (message: string) => void;
  private readonly previousSearchEmbeddings: Array<{ term: string; embedding: number[] }> = [];

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
   * Calculate cosine similarity between two embedding vectors
   */
  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Check if a new search term is semantically similar to previous ones
   */
  private async isSemanticallySimilar(
    newTerm: string,
    newEmbedding: number[],
    threshold: number = 0.85
  ): Promise<boolean> {
    if (this.previousSearchEmbeddings.length === 0) {
      return false;
    }

    for (const cached of this.previousSearchEmbeddings) {
      const similarity = this.calculateCosineSimilarity(newEmbedding, cached.embedding);
      if (similarity > threshold) {
        console.log(`🔄 Detected semantically similar search terms:`);
        console.log(`   Previous: "${cached.term}" (similarity: ${similarity.toFixed(3)})`);
        console.log(`   New: "${newTerm}" (similarity: ${similarity.toFixed(3)})`);
        return true;
      }
    }

    return false;
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
        defaultLimit: 5,
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
   * Create the prompt for generating Sanskrit search terms
   */
  private createSearchTermPrompt(searchRequest: string, previousSearchTerms: string[]): string {
    return `You are a RigVeda scholar and expert. For the given search request, generate ONE focused search phrase IN SANSKRIT/DEVANAGARI SCRIPT that would help find relevant information in the RigVeda corpus.

RIGVEDA CORPUS KNOWLEDGE:
- 10 Mandalas (books) containing hymns to various deities
- Major deities: Agni (अग्नि - fire), Indra (इन्द्र - thunder), Soma (सोम - sacred plant), Varuna (वरुण - cosmic order), Ushas (उषस् - dawn)
- Key concepts: Rita (ऋत - cosmic order), Yajna (यज्ञ - sacrifice), Brahman (ब्रह्मन्), Atman (आत्मन्)
- Famous hymns: Nasadiya/Nasadiya Sukta (नासदीय सूक्त - creation hymn in Mandala 10.129), Purusha Sukta (पुरुष सूक्त - cosmic being)
- Written in Vedic Sanskrit with Devanagari script

Search Request: ${searchRequest}

PREVIOUS SEARCH TERMS USED (DO NOT REPEAT THESE):
${previousSearchTerms.length > 0 ? previousSearchTerms.map((term, i) => `${i + 1}. "${term}"`).join('\n') : 'None (this is the first search)'}

MULTI-WORD PHRASE STRATEGY:
Generate 2-4 word Sanskrit phrases that provide rich semantic context for embedding similarity:
- Combine deity + action: "सोम पवमान यज्ञ" (Soma purification ritual)
- Combine concept + context: "इन्द्र वृत्र युद्ध" (Indra's battle with Vritra)
- Combine ritual + deity: "अग्नि होत्र देव" (Agni fire offering to gods)
- Combine philosophical + practical: "ऋत सत्य धर्म" (cosmic order, truth, duty)

EXAMPLES OF GOOD MULTI-WORD PHRASES:
- "सोम पवमान यज्ञ" (Soma purification sacrifice)
- "इन्द्र वृत्र युद्ध" (Indra's battle with Vritra)
- "अग्नि होत्र देव" (Agni fire offering to gods)
- "ऋत सत्य धर्म" (cosmic order, truth, duty)
- "नासदीय सृष्टि सूक्त" (Nasadiya creation hymn)
- "पुरुष सूक्त ब्रह्म" (Purusha Sukta Brahman)

COSINE SIMILARITY SEARCH STRATEGY:
This search uses cosine similarity on embeddings, so longer phrases provide better semantic context:
- Include related concepts, ritual contexts, and deity epithets
- Combine multiple Sanskrit terms that would appear together in verses
- Think about what phrases would have similar vector representations in the corpus

THINK: What 2-4 word Sanskrit phrase would ACTUALLY appear in RigVeda verses for this topic?
Consider what multi-word combinations would have similar semantic embeddings in the corpus.

CRITICAL: Generate a NEW multi-word phrase that is NOT in the list above. Be creative and think of alternative Sanskrit phrases that would find different results.

Generate ONE focused 2-4 word Sanskrit/Devanagari phrase that would find this in the RigVeda.
Return ONLY the Sanskrit phrase in Devanagari script, without explanations or formatting.

Sanskrit search phrase:`;
  }

  /**
   * Validate and process a generated search term
   */
  private async validateAndProcessSearchTerm(
    searchTerm: string,
    searchRequest: string
  ): Promise<string | null> {
    // Sanitize malformed Unicode characters
    const sanitizedTerm = this.sanitizeUnicode(searchTerm);

    // Check if we got Devanagari script
    if (!sanitizedTerm || !/[\u0900-\u097F]/.test(sanitizedTerm)) {
      console.log('   No Sanskrit term generated, attempting translation...');
      const sanskritQuery = await this.translateToSanskrit(searchRequest);
      return this.sanitizeUnicode(sanskritQuery);
    }

    console.log(`   Generated Sanskrit search phrase: "${sanitizedTerm}"`);
    
    // Check for semantic similarity with previous searches
    try {
      const { getEmbeddingService } = await import('../embedding-service');
      const embeddingService = getEmbeddingService();
      const embedding = await embeddingService.generateEmbedding(sanitizedTerm);
      
      const isSimilar = await this.isSemanticallySimilar(sanitizedTerm, embedding, 0.85);
      if (isSimilar) {
        console.log(`   ⚠️ Generated term is too similar to previous searches, retrying...`);
        return null; // Signal to retry
      }
      
      // Cache the embedding for future deduplication
      this.previousSearchEmbeddings.push({ term: sanitizedTerm, embedding });
      console.log(`   ✅ Generated unique search phrase: "${sanitizedTerm}"`);
      return sanitizedTerm;
    } catch (embeddingError) {
      console.warn('   ⚠️ Could not check semantic similarity, using generated term:', embeddingError);
      return sanitizedTerm;
    }
  }


  /**
   * Generate a single focused search term/phrase IN SANSKRIT based on the request
   * This is called by the orchestrator with specific search context
   */
  private async generateSearchTerm(searchRequest: string, previousSearchTerms: string[] = []): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        console.log(`🧠 Generating Sanskrit search term for: "${searchRequest}" (attempt ${attempt + 1}/${maxRetries})`);
        
        const prompt = this.createSearchTermPrompt(searchRequest, previousSearchTerms);
        const result = await generateText({
          model: this.model,
          prompt,
          temperature: 0.3 + (attempt * 0.2), // Increase temperature on retries
        });

        const searchTerm = (result.text || '').trim();
        const processedTerm = await this.validateAndProcessSearchTerm(searchTerm, searchRequest);
        
        if (processedTerm !== null) {
          return processedTerm;
        }
        
        attempt++;
      } catch (error) {
        console.error(`❌ Failed to generate search term (attempt ${attempt + 1}):`, error);
        attempt++;
        
        if (attempt >= maxRetries) {
          // Try to translate as fallback
          const sanskritQuery = await this.translateToSanskrit(searchRequest);
          return this.sanitizeUnicode(sanskritQuery);
        }
      }
    }

    // Final fallback
    const sanskritQuery = await this.translateToSanskrit(searchRequest);
    return this.sanitizeUnicode(sanskritQuery);
  }

  /**
   * Vector search tool - semantic similarity search using embeddings
   */
  async vector_search(userQuery: string, searchSuggestion?: string): Promise<AgentResponse> {
    const requestToSearch = searchSuggestion || userQuery;

    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Get the search tool
      const searchTool = getSearchTool();
      
      console.log(`🧠 Executing vector search`);
      console.log(`   User Query: "${userQuery}"`);
      if (searchSuggestion) {
        console.log(`   Search Suggestion: "${searchSuggestion}"`);
      }
      
      // Notify coordinator about search
      if (this.coordinatorCallback) {
        this.coordinatorCallback(`Vector search: "${requestToSearch}"`);
      }

      // Generate Sanskrit search term
      const searchTerm = await this.generateSearchTerm(requestToSearch, []);
      console.log(`   🧠 Performing vector search with term: "${searchTerm}"`);
      
      const searchResults = await searchTool.search(searchTerm, 5);
      console.log(`   ✅ Found ${searchResults.length} results using vector search`);

      return this.createSearchResponse(searchResults, 'vector', searchTerm, userQuery, searchSuggestion);
    } catch (error) {
      console.error('❌ Vector search error:', error);
      return this.createErrorResponse('Vector search failed', userQuery, searchSuggestion);
    }
  }

  /**
   * Text search tool - full-text search for specific terms
   */
  async text_search(userQuery: string, searchSuggestion?: string): Promise<AgentResponse> {
    const requestToSearch = searchSuggestion || userQuery;

    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Get the search engine directly for text search
      const searchEngine = getSearchEngine();
      
      console.log(`📝 Executing text search`);
      console.log(`   User Query: "${userQuery}"`);
      if (searchSuggestion) {
        console.log(`   Search Suggestion: "${searchSuggestion}"`);
      }
      
      // Notify coordinator about search
      if (this.coordinatorCallback) {
        this.coordinatorCallback(`Text search: "${requestToSearch}"`);
      }

      // Generate Sanskrit search term
      const searchTerm = await this.generateSearchTerm(requestToSearch, []);
      console.log(`   📝 Performing text search with term: "${searchTerm}"`);
      
      const textResults = await searchEngine.textSearch(searchTerm, 5);
      const searchResults = textResults.map((result) => ({
        title: `${result.book || 'Unknown'} - ${result.bookContext || 'No context'}`,
        content: result.text,
        relevance: result.score,
        source: result.book,
        bookContext: result.bookContext,
      }));
      
      console.log(`   ✅ Found ${searchResults.length} results using text search`);

      return this.createSearchResponse(searchResults, 'text', searchTerm, userQuery, searchSuggestion);
    } catch (error) {
      console.error('❌ Text search error:', error);
      return this.createErrorResponse('Text search failed', userQuery, searchSuggestion);
    }
  }

  /**
   * Book context search tool - direct verse lookup by reference
   */
  async bookContext_search(userQuery: string, searchSuggestion?: string): Promise<AgentResponse> {
    const requestToSearch = searchSuggestion || userQuery;

    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Get the search tool
      const searchTool = getSearchTool();
      
      console.log(`🎯 Executing book context search`);
      console.log(`   User Query: "${userQuery}"`);
      if (searchSuggestion) {
        console.log(`   Search Suggestion: "${searchSuggestion}"`);
      }
      
      // Notify coordinator about search
      if (this.coordinatorCallback) {
        this.coordinatorCallback(`Book context search: "${requestToSearch}"`);
      }

      // Use the search request directly as book context
      const bookContext = requestToSearch;
      console.log(`   🎯 Searching for verse reference: "${bookContext}"`);
      
      const searchResults = await searchTool.searchByBookContext(bookContext, 5);
      console.log(`   ✅ Found ${searchResults.length} results using book context search`);

      return this.createSearchResponse(searchResults, 'bookContext', bookContext, userQuery, searchSuggestion);
    } catch (error) {
      console.error('❌ Book context search error:', error);
      return this.createErrorResponse('Book context search failed', userQuery, searchSuggestion);
    }
  }

  /**
   * Hybrid search tool - combines vector and text search
   */
  async hybrid_search(userQuery: string, searchSuggestion?: string): Promise<AgentResponse> {
    const requestToSearch = searchSuggestion || userQuery;

    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      // Get the search tool
      const searchTool = getSearchTool();
      
      console.log(`🔀 Executing hybrid search`);
      console.log(`   User Query: "${userQuery}"`);
      if (searchSuggestion) {
        console.log(`   Search Suggestion: "${searchSuggestion}"`);
      }
      
      // Notify coordinator about search
      if (this.coordinatorCallback) {
        this.coordinatorCallback(`Hybrid search: "${requestToSearch}"`);
      }

      // Generate Sanskrit search term
      const searchTerm = await this.generateSearchTerm(requestToSearch, []);
      console.log(`   🔀 Performing hybrid search with term: "${searchTerm}"`);
      
      const hybridResult = await searchTool.hybridSearch(searchTerm, 5);
      const searchResults = hybridResult.results;
      console.log(`   ✅ Found ${searchResults.length} results using hybrid search`);

      return this.createSearchResponse(searchResults, 'hybrid', searchTerm, userQuery, searchSuggestion);
    } catch (error) {
      console.error('❌ Hybrid search error:', error);
      return this.createErrorResponse('Hybrid search failed', userQuery, searchSuggestion);
    }
  }

  /**
   * Create a standardized search response
   */
  private createSearchResponse(
    searchResults: SearchResult[], 
    searchType: string, 
    searchTerm: string,
    userQuery: string,
    searchSuggestion?: string
  ): AgentResponse {
    // Log search results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 SEARCH RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Search Type: ${searchType}`);
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
        nextAgent: 'analyzer',
        isComplete: false,
        searchResults: [],
        statusMessage: 'No results found',
        metadata: {
          toolCall: {
            name: `${searchType}_search` as 'vector_search' | 'text_search' | 'bookContext_search' | 'hybrid_search',
            parameters: {
              userQuery,
              searchSuggestion
            }
          }
        }
      };
    }

    return {
      content: `Found ${searchResults.length} relevant verses from the RigVeda using ${searchType} search.`,
      nextAgent: 'analyzer',
      isComplete: false,
      searchResults: searchResults,
      statusMessage: `Found ${searchResults.length} relevant verses (${searchType} search)`,
      metadata: {
        toolCall: {
          name: `${searchType}_search` as any,
          parameters: {
            userQuery,
            searchSuggestion
          }
        }
      }
    };
  }

  /**
   * Create a standardized error response
   */
  private createErrorResponse(errorMessage: string, userQuery: string, searchSuggestion?: string): AgentResponse {
    console.log('⚠️ Falling back to simulated search results');
    const fallbackResults = this.createFallbackResults(userQuery);
    
    return {
      content: `Search completed (using fallback results) - ${errorMessage}`,
      nextAgent: 'analyzer',
      isComplete: false,
      searchResults: fallbackResults,
      statusMessage: 'Search completed with fallback results',
        metadata: {
          toolCall: {
            name: 'fallback_search' as 'fallback_search',
            parameters: {
              userQuery,
              searchSuggestion
            }
          }
        }
    };
  }

  /**
   * Create fallback results if LLM fails to generate proper JSON
   */
  private createFallbackResults(query: string): SearchResult[] {
    return [
      {
        title: 'Sanskrit Literature Reference',
        content: `Information related to: ${query}. This is a fallback result as the search system encountered an issue.`,
        relevance: 0.7,
        source: 'Sanskrit Knowledge Base',
        bookContext: 'Fallback-1',
      },
      {
        title: 'Classical Text Reference',
        content: 'Relevant passages and teachings from classical Sanskrit texts.',
        relevance: 0.6,
        source: 'Sanskrit Texts',
        bookContext: 'Fallback-2',
      },
    ];
  }

  /**
   * Perform additional search with new context from analyzer
   * This is called when the analyzer determines it needs more information
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
        const searchResult = await searchTool.searchWithEmbedding(searchTerm, 5);
        newSearchResults = searchResult.results;
        console.log(`   ✅ Found ${newSearchResults.length} results`);
        
        // Cache the embedding for this search term if we have results and embedding
        if (newSearchResults.length > 0 && searchResult.queryEmbedding) {
          // Only cache if not already cached (avoid duplicates)
          const alreadyCached = this.previousSearchEmbeddings.some(
            cached => cached.term === searchTerm
          );
          if (!alreadyCached) {
            this.previousSearchEmbeddings.push({ term: searchTerm, embedding: searchResult.queryEmbedding });
            console.log(`   📝 Cached embedding for future deduplication`);
          }
        }
      } catch (error) {
        console.error(`   ❌ Search failed for term "${searchTerm}":`, error);
      }

      // Filter out duplicates based on bookContext
      const previousBookContexts = new Set(previousResults.map(r => r.bookContext));
      const uniqueNewResults = newSearchResults.filter(r => !previousBookContexts.has(r.bookContext));

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
        nextAgent: 'analyzer',
        isComplete: false,
        searchResults: allResults,
        statusMessage: `Found ${uniqueNewResults.length} new verses (${allResults.length} total)`,
        // Add metadata to track new vs all results for UI display
        metadata: {
          newResults: uniqueNewResults,
          allResults: allResults,
          toolCall: {
            name: 'additional_search' as 'additional_search',
            parameters: {
              userQuery: searchRequest,
              searchSuggestion: searchRequest
            }
          }
        }
      };
    } catch (error) {
      console.error('❌ Searcher additional search error:', error);
      return {
        content: 'Error performing additional search',
        nextAgent: 'analyzer',
        isComplete: false,
        searchResults: previousResults, // Return previous results on error
        statusMessage: 'Additional search failed, using previous results',
        metadata: {
          toolCall: {
            name: 'error_search' as 'error_search',
            parameters: {
              userQuery: searchRequest,
              searchSuggestion: searchRequest
            }
          }
        }
      };
    }
  }
}

