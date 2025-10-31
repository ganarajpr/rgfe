import { LanguageModelV2 } from '@ai-sdk/provider';
import { generateText } from 'ai';
import { AgentContext, AgentResponse, SearchResult } from './types';
import { getSearchTool } from '../tools/search-tool';

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
   * Translate English query to Sanskrit search terms with Rgveda context
   */
  private async translateToSanskrit(englishQuery: string): Promise<string> {
    try {
      console.log(`🌐 Translating query to Sanskrit: "${englishQuery}"`);
      
      const prompt = `You are a Rgveda scholar. Translate the following query into Sanskrit/Devanagari search terms that would be found in the Rgveda corpus.

RGVEDA CONTEXT:
- Corpus contains 10 Mandalas with hymns to deities like Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण)
- Key concepts: Rita (ऋत), Yajna (यज्ञ), Dharma (धर्म)
- Famous hymns: Nasadiya Sukta (नासदीय सूक्त), Purusha Sukta (पुरुष सूक्त)
- Written in Vedic Sanskrit/Devanagari script

User Query: ${englishQuery}

Generate 2-5 relevant Sanskrit/Devanagari keywords that would help find this topic in the Rgveda.
Think: What Sanskrit terms would actually appear in Rgveda verses?

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
        binaryFilePath: '/smrthi-rgveda-test-512d.bin',
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
    return `You are a Rgveda scholar and expert. For the given search request, generate ONE focused search phrase IN SANSKRIT/DEVANAGARI SCRIPT that would help find relevant information in the Rgveda corpus.

RGVEDA CORPUS KNOWLEDGE:
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

THINK: What 2-4 word Sanskrit phrase would ACTUALLY appear in Rgveda verses for this topic?
Consider what multi-word combinations would have similar semantic embeddings in the corpus.

CRITICAL: Generate a NEW multi-word phrase that is NOT in the list above. Be creative and think of alternative Sanskrit phrases that would find different results.

Generate ONE focused 2-4 word Sanskrit/Devanagari phrase that would find this in the Rgveda.
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
   * Extract verse numbers from query (e.g., "10.129", "RV 10.129.1", "Mandala 10")
   */
  private extractVerseReference(query: string): string | null {
    // Match patterns like: 10.129, RV 10.129, RV.10.129.1, Mandala 10, etc.
    const patterns = [
      /(?:RV\.?|Rig\s*Veda)?\s*(\d+\.\d+(?:\.\d+)?)/i,  // 10.129 or RV 10.129.1
      /Mandala\s+(\d+)/i,                                  // Mandala 10
      /Book\s+(\d+)/i,                                     // Book 10
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Check for famous hymn names with known references
    const famousHymns: Record<string, string> = {
      'nasadiya': '10.129',
      'purusha sukta': '10.90',
      'gayatri': '3.62.10',
      'hiranyagarbha': '10.121',
    };

    const lowerQuery = query.toLowerCase();
    for (const [name, ref] of Object.entries(famousHymns)) {
      if (lowerQuery.includes(name)) {
        console.log(`   📖 Recognized famous hymn "${name}" → ${ref}`);
        return ref;
      }
    }

    return null;
  }

  /**
   * Check if query contains exact text phrases (for text similarity search)
   */
  private hasExactTextPhrase(query: string): boolean {
    // Check for quotes or specific indicators of exact text
    if (query.includes('"') || query.includes("'")) {
      return true;
    }

    // Check for phrases that suggest looking for specific text
    const exactTextIndicators = [
      'exact words',
      'specifically says',
      'contains the phrase',
      'word for word',
      'verbatim',
    ];

    const lowerQuery = query.toLowerCase();
    return exactTextIndicators.some(indicator => lowerQuery.includes(indicator));
  }

  /**
   * Perform search with book context priority
   * Flow: 1) Book context → analyzer → proceed OR 2) Fall back to hybrid search
   */
  async search(context: AgentContext, signal?: AbortSignal, searchRequest?: string): Promise<AgentResponse> {
    const requestToSearch = searchRequest || context.userQuery;

    try {
      // Ensure search tool is initialized
      if (!this.searchToolInitialized) {
        await this.initializeSearchTool();
      }

      let searchResults: SearchResult[] = [];
      let searchMethod = '';
      let bookContextAttempted = false;

      // STEP 1: Check for verse numbers/book context
      const verseRef = this.extractVerseReference(requestToSearch);
      if (verseRef) {
        console.log(`📖 STEP 1: Book Context Search for "${verseRef}"`);
        searchMethod = `Book context: ${verseRef}`;
        bookContextAttempted = true;
        
        if (this.coordinatorCallback) {
          this.coordinatorCallback(`Searching book context: ${verseRef}`);
        }

        try {
          // Get search engine directly to use simplified book context search
          const searchEngine = await import('../search-engine').then(m => m.getSearchEngine());
          const contextResults = await searchEngine.searchByBookContext(verseRef, 20);
          
          searchResults = contextResults.map(r => ({
            id: r.id,
            title: `${r.book || 'Unknown'} - ${r.bookContext || 'No context'}`,
            content: r.text,
            relevance: r.score,
            source: r.book,
            bookContext: r.bookContext,
          }));
          
          console.log(`   ✅ Found ${searchResults.length} verses in context ${verseRef}`);
          
          // If we found verses, pass them to analyzer
          // The orchestrator will handle sending these to the analyzer
          if (searchResults.length > 0) {
            console.log(`   ✅ Book context search successful, passing ${searchResults.length} verses to analyzer`);
            return {
              content: `Found ${searchResults.length} verses in ${verseRef}.`,
              nextAgent: 'analyzer',
              isComplete: false,
              searchResults: searchResults,
              statusMessage: `Found ${searchResults.length} verses in ${verseRef}`,
            };
          } else {
            console.log(`   ⚠️ No verses found in book context "${verseRef}", falling back to hybrid search`);
          }
        } catch (error) {
          console.error(`   ❌ Book context search failed:`, error);
        }
      }

      // STEP 2: Fall back to hybrid search (semantic + text)
      console.log(`🔍 STEP 2: Hybrid Search (book context ${bookContextAttempted ? 'returned no results' : 'not detected'})`);
      searchMethod = 'Hybrid search';
      
      // Generate Sanskrit search term for semantic search
      const searchTerm = await this.generateSearchTerm(requestToSearch, []);
      console.log(`🔍 Performing hybrid search with term: "${searchTerm}"`);
      
      if (this.coordinatorCallback) {
        this.coordinatorCallback(`Searching: "${searchTerm}"`);
      }

      try {
        const searchTool = getSearchTool();
        searchResults = await searchTool.search(searchTerm, 15); // Get more results for hybrid
        console.log(`   ✅ Found ${searchResults.length} results using hybrid search`);
      } catch (error) {
        console.error(`   ❌ Hybrid search failed for term "${searchTerm}":`, error);
      }

      // Log search results
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 SEARCH RESULTS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Search method: ${searchMethod}`);
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
          content: 'No results found in the Rgveda corpus for this search.',
          nextAgent: 'generator',
          isComplete: false,
          searchResults: [],
          statusMessage: 'No results found',
        };
      }

      return {
        content: `Found ${searchResults.length} relevant verses from the Rgveda.`,
        nextAgent: 'analyzer',
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
        content: `Found ${uniqueNewResults.length} additional verses from the Rgveda.`,
        nextAgent: 'generator',
        isComplete: false,
        searchResults: allResults,
        statusMessage: `Found ${uniqueNewResults.length} new verses (${allResults.length} total)`,
        // Add metadata to track new vs all results for UI display
        metadata: {
          newResults: uniqueNewResults,
          allResults: allResults
        }
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

