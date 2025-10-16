import { getSearchEngine, SearchResultItem } from '../search-engine';
import { SearchResult } from '../agents/types';
import { getEmbeddingService, DEFAULT_EMBEDDING_CONFIG } from '../embedding-service';

export interface SearchResultWithEmbedding {
  results: SearchResult[];
  queryEmbedding?: number[];
}

/**
 * Search Tool for the Searcher Agent
 * Provides real semantic search capabilities over the Sanskrit text corpus
 */

export interface SearchToolConfig {
  binaryFilePath: string;
  defaultLimit?: number;
  minScore?: number;
  useEmbeddings?: boolean; // Whether to use embeddings for search
}

export class SearchTool {
  private readonly config: SearchToolConfig;
  private isInitialized = false;
  private embeddingServiceInitialized = false;

  constructor(config: SearchToolConfig) {
    this.config = {
      defaultLimit: 5,
      minScore: 0.0, // Use 0.0 for cosine similarity (matches cli-search.js behavior)
      useEmbeddings: true, // Default to using embeddings
      ...config,
    };
  }

  /**
   * Initialize the search tool
   * This should be called before using the tool, preferably on app startup
   */
  async initialize(progressCallback?: (progress: number, message: string) => void): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize search engine
      const searchEngine = getSearchEngine({
        binaryFilePath: this.config.binaryFilePath,
        embeddingDimension: 512,
      });
      
      await searchEngine.initialize();
      console.log('✅ Search engine initialized');

      // Initialize embedding service if using embeddings (client-only)
      if (this.config.useEmbeddings && DEFAULT_EMBEDDING_CONFIG.modelId && typeof window !== 'undefined') {
        try {
          const embeddingService = getEmbeddingService(DEFAULT_EMBEDDING_CONFIG);
          await embeddingService.initialize(progressCallback);
          this.embeddingServiceInitialized = true;
          console.log('✅ Embedding service initialized');
        } catch (error) {
          console.warn('⚠️ Failed to initialize embedding service, will use text search:', error);
          this.embeddingServiceInitialized = false;
        }
      } else {
        console.log('ℹ️ Embedding service unavailable (server or disabled), using text search only');
        this.embeddingServiceInitialized = false;
      }

      this.isInitialized = true;
      console.log('✅ Search tool fully initialized');
    } catch (error) {
      console.error('❌ Failed to initialize search tool:', error);
      throw error;
    }
  }

  /**
   * Perform a semantic search (with embeddings if enabled, otherwise text search)
   * @param query - The search query text
   * @param limit - Maximum number of results (optional)
   * @returns Array of search results in agent-friendly format
   */
  async search(query: string, limit?: number): Promise<SearchResult[]> {
    const result = await this.searchWithEmbedding(query, limit);
    return result.results;
  }

  /**
   * Perform a semantic search and return both results and query embedding
   * @param query - The search query text
   * @param limit - Maximum number of results (optional)
   * @returns Search results with query embedding
   */
  async searchWithEmbedding(query: string, limit?: number): Promise<SearchResultWithEmbedding> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const searchEngine = getSearchEngine();
      const searchLimit = limit || this.config.defaultLimit || 5;
      
      // If embeddings are enabled, use vector search
      if (this.config.useEmbeddings && this.embeddingServiceInitialized) {
        try {
          console.log('🔍 Using semantic vector search with embeddings');
          
          // Generate embedding for the query
          const embeddingService = getEmbeddingService();
          const queryEmbedding = await embeddingService.generateEmbedding(query);
          
          // Perform vector search
          const minScore = this.config.minScore ?? 0.1;
          const results = await searchEngine.vectorSearch(
            queryEmbedding,
            searchLimit,
            minScore
          );
          
          console.log(`✅ Found ${results.length} results using vector search`);
          
          // Convert to agent-friendly format
          return {
            results: this.convertToAgentResults(results),
            queryEmbedding: queryEmbedding
          };
        } catch (error) {
          console.warn('⚠️ Vector search failed, falling back to text search:', error);
          // Fall through to text search below
        }
      }
      
      // Fall back to text search
      console.log('🔍 Using full-text search (embeddings not available)');
      const results = await searchEngine.textSearch(query, searchLimit);
      
      console.log(`✅ Found ${results.length} results using text search`);
      
      // Convert to agent-friendly format
      return {
        results: this.convertToAgentResults(results),
        queryEmbedding: undefined // No embedding available for text search
      };
    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Perform a vector search with a query embedding
   * @param queryEmbedding - The embedding vector for the query
   * @param limit - Maximum number of results (optional)
   * @returns Array of search results in agent-friendly format
   */
  async vectorSearch(queryEmbedding: number[], limit?: number): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔍 Using direct vector search with provided embedding');
      console.log(`   - Embedding dimension: ${queryEmbedding.length}`);
      console.log(`   - First 5 values: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      
      const searchEngine = getSearchEngine();
      const searchLimit = limit || this.config.defaultLimit || 5;
      const minScore = this.config.minScore ?? 0.1;
      
      // Perform vector search
      const results = await searchEngine.vectorSearch(
        queryEmbedding,
        searchLimit,
        minScore
      );
      
      console.log(`✅ Found ${results.length} results using direct vector search`);
      
      // Convert to agent-friendly format
      return this.convertToAgentResults(results);
    } catch (error) {
      console.error('❌ Vector search failed:', error);
      throw error;
    }
  }

  /**
   * Convert search engine results to agent-friendly format
   */
  private convertToAgentResults(results: SearchResultItem[]): SearchResult[] {
    return results.map((result) => ({
      id: result.id,
      title: `${result.book || 'Unknown'} - ${result.bookContext || 'No context'}`,
      content: result.text,
      relevance: result.score,
      source: result.book,
      bookContext: result.bookContext, // Pass through the verse reference
    }));
  }

  /**
   * Check if the search tool is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get search statistics
   */
  async getStats(): Promise<{ documentCount: number; isReady: boolean }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const searchEngine = getSearchEngine();
    return {
      documentCount: searchEngine.getDocumentCount(),
      isReady: searchEngine.isReady(),
    };
  }
}

// Export a singleton instance
let searchToolInstance: SearchTool | null = null;

export function getSearchTool(config?: SearchToolConfig): SearchTool {
  if (!searchToolInstance && config) {
    searchToolInstance = new SearchTool(config);
  }
  
  if (!searchToolInstance) {
    throw new Error('Search tool not initialized. Provide config on first call.');
  }
  
  return searchToolInstance;
}

