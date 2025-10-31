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
        components: {
          tokenizer: {
            language: 'sanskrit', // Use Sanskrit tokenizer for Devanagari script
            stemming: false,
            stopWords: [],
          },
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
   * Perform hybrid search combining vector and text search
   * @param queryText - The text query
   * @param queryEmbedding - The embedding vector for the query
   * @param limit - Maximum number of results to return (default: 5)
   * @param vectorWeight - Weight for vector search scores (default: 0.7)
   * @param textWeight - Weight for text search scores (default: 0.3)
   * @returns Array of search results with combined scores
   */
  async hybridSearch(
    queryText: string,
    queryEmbedding: number[],
    limit: number = 5,
    vectorWeight: number = 0.7,
    textWeight: number = 0.3
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
      console.log(`   - Vector weight: ${vectorWeight}`);
      console.log(`   - Text weight: ${textWeight}`);
      console.log('───────────────────────────────────────────────────────────');

      // Run both searches in parallel with higher limits to ensure good coverage
      const searchLimit = limit * 3;
      const [vectorResults, textResults] = await Promise.all([
        this.vectorSearch(queryEmbedding, searchLimit, 0.0),
        this.textSearch(queryText, searchLimit),
      ]);

      console.log(`📊 Vector search found ${vectorResults.length} results`);
      console.log(`📊 Text search found ${textResults.length} results`);

      // Normalize scores for each result set
      const normalizeScores = (results: SearchResultItem[]) => {
        if (results.length === 0) return results;
        const maxScore = Math.max(...results.map(r => r.score));
        const minScore = Math.min(...results.map(r => r.score));
        const range = maxScore - minScore || 1;
        
        return results.map(r => ({
          ...r,
          score: (r.score - minScore) / range,
        }));
      };

      const normalizedVectorResults = normalizeScores(vectorResults);
      const normalizedTextResults = normalizeScores(textResults);

      // Combine results with weighted scores
      const combinedResults = new Map<string, SearchResultItem>();

      // Add vector results
      normalizedVectorResults.forEach((result) => {
        combinedResults.set(result.id, {
          ...result,
          score: result.score * vectorWeight,
        });
      });

      // Add or merge text results
      normalizedTextResults.forEach((result) => {
        const existing = combinedResults.get(result.id);
        if (existing) {
          // Document found in both searches - combine scores
          existing.score += result.score * textWeight;
        } else {
          // Document only in text search
          combinedResults.set(result.id, {
            ...result,
            score: result.score * textWeight,
          });
        }
      });

      // Sort by combined score and take top N
      const finalResults = Array.from(combinedResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      console.log('📊 HYBRID SEARCH RESULTS');
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Combined ${finalResults.length} unique results`);
      
      if (finalResults.length > 0) {
        console.log('\nTop Results:');
        finalResults.slice(0, 5).forEach((result, idx) => {
          console.log(`\n${idx + 1}. Combined Score: ${result.score.toFixed(4)}`);
          console.log(`   Source: ${result.book} - ${result.bookContext}`);
          console.log(`   Text: ${(result.text || 'No text available').substring(0, 100)}${(result.text || '').length > 100 ? '...' : ''}`);
        });
      }
      console.log('═══════════════════════════════════════════════════════════\n');

      return finalResults;
    } catch (error) {
      console.error('❌ Hybrid search failed:', error);
      throw error;
    }
  }

  /**
   * Normalize book context for matching (handles different formats)
   * Examples: "RV.10.129", "10.129", "RV 10.129.1" all normalize to "10.129"
   */
  private normalizeBookContext(context: string): string {
    // Remove "RV", "RV.", spaces, and convert to lowercase
    let normalized = context
      .toLowerCase()
      .replace(/^rv\.?/i, '')  // Remove RV or RV. prefix
      .replace(/\s+/g, '')      // Remove spaces
      .trim();
    
    return normalized;
  }

  /**
   * Check if a document's book context matches the search context
   * Handles partial matching: "10.129" matches "10.129.1", "10.129.2", etc.
   */
  private matchesBookContext(docContext: string | undefined, searchContext: string): boolean {
    if (!docContext) return false;
    
    const normalizedDoc = this.normalizeBookContext(docContext);
    const normalizedSearch = this.normalizeBookContext(searchContext);
    
    // Check if document context starts with or contains the search context
    // "10.129.1" should match search for "10.129"
    // "10.129" should match search for "10.129"
    return normalizedDoc.startsWith(normalizedSearch) || normalizedDoc.includes('.' + normalizedSearch);
  }

  /**
   * Search within a specific book context - returns ALL verses in that context
   * @param bookContext - The book context to filter by (e.g., "RV.1.1", "RV.10.129", "10.129")
   * @param limit - Maximum number of results to return (default: 20)
   * @returns Array of search results filtered by book context (no additional searching)
   */
  async searchByBookContext(
    bookContext: string,
    limit: number = 20
  ): Promise<SearchResultItem[]> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }

    if (!this.db) {
      throw new Error('Search engine is not properly initialized');
    }

    try {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📖 BOOK CONTEXT SEARCH (Exact Match)');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Book Context: "${bookContext}"`);
      console.log(`Limit: ${limit}`);
      console.log('───────────────────────────────────────────────────────────');

      // Filter documents by book context using flexible matching
      const filteredDocs = this.documents.filter(doc => 
        this.matchesBookContext(doc.bookContext, bookContext)
      );

      console.log(`📚 Found ${filteredDocs.length} verses in context "${bookContext}"`);

      if (filteredDocs.length === 0) {
        console.log('⚠️ No verses found in the specified book context');
        console.log('═══════════════════════════════════════════════════════════\n');
        return [];
      }

      // Return all verses from the book context directly (no semantic search)
      // Sort by ID to maintain verse order
      const results = filteredDocs
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(doc => ({
          id: doc.id,
          text: doc.text,
          book: doc.book,
          bookContext: doc.bookContext,
          score: 1.0, // All verses get equal score (context match)
        }))
        .slice(0, limit);

      console.log('📊 BOOK CONTEXT RESULTS');
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Returning ${results.length} verses from "${bookContext}"`);
      
      if (results.length > 0) {
        console.log('\nSample verses:');
        results.slice(0, 3).forEach((result, idx) => {
          console.log(`\n${idx + 1}. ${result.bookContext}`);
          console.log(`   Text: ${(result.text || 'No text available').substring(0, 100)}${(result.text || '').length > 100 ? '...' : ''}`);
        });
      }
      console.log('═══════════════════════════════════════════════════════════\n');

      return results;
    } catch (error) {
      console.error('❌ Book context search failed:', error);
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

