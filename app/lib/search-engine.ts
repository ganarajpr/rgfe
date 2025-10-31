import { create, insert, search, Orama } from '@orama/orama';
import type { DocumentWithEmbedding } from './binary-persistence';

/**
 * Search Engine using Orama vector search
 * Provides semantic search capabilities over the Sanskrit text corpus
 */

export interface SearchResultItem {
  id: string;
  text?: string; // Make optional to handle null/undefined cases
  book?: string; // Make optional to handle null/undefined cases
  bookContext?: string; // Make optional to handle null/undefined cases
  score: number;
}

export interface SearchEngineConfig {
  binaryFilePath: string;
  embeddingDimension?: number;
}

class SearchEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: Orama<any> | null = null;
  private documents: DocumentWithEmbedding[] = [];
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly config: SearchEngineConfig;

  constructor(config: SearchEngineConfig) {
    this.config = config;
  }

  /**
   * Initialize the search engine by loading the binary index
   */
  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this._initializeInternal();
    await this.initializationPromise;
  }

  private async _initializeInternal(): Promise<void> {
    try {
      console.log('🔧 Initializing search engine...');
      
      // Load documents from binary file (lazy import to avoid server bundling)
      const { loadOramaDataBinary } = await import('./binary-persistence');
      this.documents = await loadOramaDataBinary(this.config.binaryFilePath);
      
      console.log(`📚 Loaded ${this.documents.length} documents`);
      
      // Create Orama database with vector search support
      this.db = create({
        schema: {
          id: 'string',
          text: 'string',
          book: 'string',
          bookContext: 'string',
          embedding: `vector[${this.config.embeddingDimension || 512}]`,
        },
      });

      // Insert all documents into the database
      console.log('📥 Inserting documents into search index...');
      for (const doc of this.documents) {
        await insert(this.db, {
          id: doc.id,
          text: doc.text,
          book: doc.book,
          bookContext: doc.bookContext,
          embedding: doc.embedding,
        });
      }

      this.isInitialized = true;
      console.log('✅ Search engine initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize search engine:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Perform vector search with a query embedding
   * @param queryEmbedding - The embedding vector for the search query
   * @param limit - Maximum number of results to return (default: 5)
   * @param threshold - Minimum similarity threshold (default: 0.0)
   * @returns Array of search results
   */
  async vectorSearch(
    queryEmbedding: number[],
    limit: number = 5,
    threshold: number = 0.0
  ): Promise<SearchResultItem[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Search engine is not properly initialized');
    }

    try {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 VECTOR SEARCH');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Parameters:');
      console.log(`   - Limit: ${limit}`);
      console.log(`   - Threshold: ${threshold}`);
      console.log(`   - Embedding dimension: ${queryEmbedding.length}`);
      
      // Calculate embedding norm for debugging
      const norm = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
      console.log(`   - Query embedding norm: ${norm.toFixed(4)}`);
      console.log(`   - First 5 values: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      console.log('───────────────────────────────────────────────────────────');
      
      const results = await search(this.db, {
        mode: 'vector',
        vector: {
          value: queryEmbedding,
          property: 'embedding',
        },
        limit,
        similarity: threshold, // Use similarity parameter like in cli-search.js
        includeVectors: false, // Don't include vectors to save memory
      });

      // Map to our result format (already filtered by similarity threshold)
      const searchResults = results.hits.map((hit) => ({
        id: hit.document.id as string,
        text: hit.document.text as string,
        book: hit.document.book as string,
        bookContext: hit.document.bookContext as string,
        score: hit.score,
      }));

      console.log('📊 VECTOR SEARCH RESULTS');
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Found ${searchResults.length} results`);
      
      if (searchResults.length > 0) {
        console.log('\nTop Results:');
        searchResults.slice(0, 5).forEach((result, idx) => {
          console.log(`\n${idx + 1}. Score: ${result.score.toFixed(4)}`);
          console.log(`   Source: ${result.book} - ${result.bookContext}`);
          console.log(`   Text: ${(result.text || 'No text available').substring(0, 100)}${(result.text || '').length > 100 ? '...' : ''}`);
        });
      } else {
        console.log('⚠️ No results matched the similarity threshold');
      }
      console.log('═══════════════════════════════════════════════════════════\n');

      return searchResults;
    } catch (error) {
      console.error('❌ Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Perform text search (without embeddings)
   * @param queryText - The text query
   * @param limit - Maximum number of results to return (default: 5)
   * @returns Array of search results
   */
  async textSearch(
    queryText: string,
    limit: number = 10
  ): Promise<SearchResultItem[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Search engine is not properly initialized');
    }

    try {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 TEXT SEARCH (Full-text)');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Query: "${queryText}"`);
      console.log('Parameters:');
      console.log(`   - Limit: ${limit}`);
      console.log(`   - Tolerance: 1`);
      console.log(`   - Search fields: text, book, bookContext`);
      console.log('───────────────────────────────────────────────────────────');
      
      const results = await search(this.db, {
        term: queryText,
        properties: ['text', 'book', 'bookContext'],
        limit,
        tolerance: 1,
      });

      const searchResults = results.hits.map((hit) => ({
        id: hit.document.id as string,
        text: hit.document.text as string,
        book: hit.document.book as string,
        bookContext: hit.document.bookContext as string,
        score: hit.score,
      }));

      console.log('📊 TEXT SEARCH RESULTS');
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Found ${searchResults.length} results`);
      
      if (searchResults.length > 0) {
        console.log('\nTop Results:');
        searchResults.slice(0, 5).forEach((result, idx) => {
          console.log(`\n${idx + 1}. Score: ${result.score.toFixed(4)}`);
          console.log(`   Source: ${result.book} - ${result.bookContext}`);
          console.log(`   Text: ${(result.text || 'No text available').substring(0, 100)}${(result.text || '').length > 100 ? '...' : ''}`);
        });
      } else {
        console.log('⚠️ No results found for this query');
      }
      console.log('═══════════════════════════════════════════════════════════\n');

      return searchResults;
    } catch (error) {
      console.error('❌ Text search failed:', error);
      throw error;
    }
  }

  /**
   * Perform search by specific book context (verse reference)
   * @param bookContext - The verse reference (e.g., "10.39", "7.50.1")
   * @param limit - Maximum number of results to return (default: 10)
   * @returns Array of search results
   */
  async searchByBookContext(bookContext: string, limit: number = 10): Promise<SearchResultItem[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Search engine is not properly initialized');
    }

    try {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 BOOK CONTEXT SEARCH');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Book Context: "${bookContext}"`);
      console.log('Parameters:');
      console.log(`   - Limit: ${limit}`);
      console.log(`   - Search field: bookContext only`);
      console.log('───────────────────────────────────────────────────────────');
      
      // Extract the mandala.sukta prefix from the query for proper matching
      const parts = bookContext.split('.');
      let searchPrefix = bookContext;

      if (parts.length >= 2) {
        // Query like "1.1" or "1.1.1" - search for prefix "1.1."
        searchPrefix = `${parts[0]}.${parts[1]}.`;
      } else if (parts.length === 1) {
        // Query like "1" - search for prefix "1."
        searchPrefix = `${parts[0]}.`;
      }

      console.log(`   - Search prefix: "${searchPrefix}"`);

      // For prefix search on bookContext, search for the exact prefix with trailing dot
      // Test results show that searching for "10.129." with tolerance 0 works best
      // We use a higher limit to ensure we capture all matches, then filter by prefix
      const results = await search(this.db, {
        term: searchPrefix,
        properties: ['bookContext'],
        limit: limit * 10, // Get more results to ensure we find all prefix matches
        tolerance: 0, // Exact match for verse references (tested and confirmed to work)
      });

      // Post-filter results to ensure exact prefix match on bookContext
      // This ensures we only return documents where bookContext starts with our searchPrefix
      const filteredResults = results.hits.filter(hit => {
        const context = hit.document.bookContext as string;
        if (!context) return false;
        // Match if bookContext starts with the searchPrefix
        return context.startsWith(searchPrefix);
      }).slice(0, limit); // Limit after filtering

      const searchResults = filteredResults.map((hit) => ({
        id: hit.document.id as string,
        text: hit.document.text as string,
        book: hit.document.book as string,
        bookContext: hit.document.bookContext as string,
        score: hit.score,
      }));

      console.log('📊 BOOK CONTEXT SEARCH RESULTS');
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Found ${searchResults.length} results`);
      
      if (searchResults.length > 0) {
        console.log('\nResults:');
        searchResults.forEach((result, idx) => {
          console.log(`\n${idx + 1}. Score: ${result.score.toFixed(4)}`);
          console.log(`   Source: ${result.book} - ${result.bookContext}`);
          console.log(`   Text: ${(result.text || 'No text available').substring(0, 100)}${(result.text || '').length > 100 ? '...' : ''}`);
        });
      } else {
        console.log('⚠️ No results found for this book context');
      }
      console.log('═══════════════════════════════════════════════════════════\n');

      return searchResults;
    } catch (error) {
      console.error('❌ Book context search failed:', error);
      throw error;
    }
  }

  /**
   * Perform hybrid search combining vector and text search
   * @param queryText - The text query
   * @param queryEmbedding - The embedding vector for the search query
   * @param limit - Maximum number of results to return (default: 10)
   * @param threshold - Minimum similarity threshold (default: 0.0)
   * @returns Array of search results
   */
  async hybridSearch(
    queryText: string,
    queryEmbedding: number[],
    limit: number = 10,
    threshold: number = 0.0
  ): Promise<SearchResultItem[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Search engine is not properly initialized');
    }

    try {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔍 HYBRID SEARCH (Vector + Text)');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Query: "${queryText}"`);
      console.log('Parameters:');
      console.log(`   - Limit: ${limit}`);
      console.log(`   - Threshold: ${threshold}`);
      console.log(`   - Embedding dimension: ${queryEmbedding.length}`);
      console.log('───────────────────────────────────────────────────────────');
      
      const results = await search(this.db, {
        mode: 'hybrid',
        term: queryText,
        vector: {
          value: queryEmbedding,
          property: 'embedding',
        },
        properties: ['text', 'book', 'bookContext'],
        limit,
        similarity: threshold,
        includeVectors: false,
      });

      const searchResults = results.hits.map((hit) => ({
        id: hit.document.id as string,
        text: hit.document.text as string,
        book: hit.document.book as string,
        bookContext: hit.document.bookContext as string,
        score: hit.score,
      }));

      console.log('📊 HYBRID SEARCH RESULTS');
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Found ${searchResults.length} results`);
      
      if (searchResults.length > 0) {
        console.log('\nTop Results:');
        searchResults.slice(0, 5).forEach((result, idx) => {
          console.log(`\n${idx + 1}. Score: ${result.score.toFixed(4)}`);
          console.log(`   Source: ${result.book} - ${result.bookContext}`);
          console.log(`   Text: ${(result.text || 'No text available').substring(0, 100)}${(result.text || '').length > 100 ? '...' : ''}`);
        });
      } else {
        console.log('⚠️ No results matched the similarity threshold');
      }
      console.log('═══════════════════════════════════════════════════════════\n');

      return searchResults;
    } catch (error) {
      console.error('❌ Hybrid search failed:', error);
      throw error;
    }
  }

  /**
   * Get the total number of documents in the index
   */
  getDocumentCount(): number {
    return this.documents.length;
  }

  /**
   * Check if the search engine is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export a singleton instance
let searchEngineInstance: SearchEngine | null = null;

export function getSearchEngine(config?: SearchEngineConfig): SearchEngine {
  if (!searchEngineInstance && config) {
    searchEngineInstance = new SearchEngine(config);
  }
  
  if (!searchEngineInstance) {
    throw new Error('Search engine not initialized. Provide config on first call.');
  }
  
  return searchEngineInstance;
}

export { SearchEngine };

