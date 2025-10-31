import { tool } from 'ai';
import { z } from 'zod';
import { getSearchTool } from '../tools/search-tool';
import { getSearchEngine } from '../search-engine';
import { SearchResult } from './types';

// Initialize search tool with proper configuration
const initializeSearchTool = () => {
  return getSearchTool({
    binaryFilePath: '/smrthi-rgveda-test-512d.bin',
    defaultLimit: 5,
    minScore: 0, // Use 0 like cli-search.js for cosine similarity
    useEmbeddings: true, // Enable semantic vector search with EmbeddingGemma
  });
};

/**
 * AI SDK Tools for the RigVeda search system
 * These tools are used by the AI SDK Agent system for proper tool calling
 */

// Note: Sanskrit search term generation would be implemented here in a full version
// For now, we use the user query directly as the search term

// Helper function to convert search engine results to our format
function convertToSearchResults(results: Array<{ book?: string; bookContext?: string; text?: string; score: number }>): SearchResult[] {
  return results.map((result) => ({
    title: `${result.book || 'Unknown'} - ${result.bookContext || 'No context'}`,
    content: result.text || 'No content available',
    relevance: result.score,
    source: result.book,
    bookContext: result.bookContext,
  }));
}

/**
 * Vector Search Tool - Semantic similarity search using embeddings
 */
export const vectorSearchTool = tool({
  description: 'Perform semantic similarity search using embeddings to find conceptually related verses',
  inputSchema: z.object({
    userQuery: z.string().describe('The user\'s original query'),
    searchSuggestion: z.string().optional().describe('Optional suggestion for search term from another agent'),
  }),
  execute: async ({ userQuery, searchSuggestion }) => {
    try {
      console.log('🔍 Vector search tool called with:', { userQuery, searchSuggestion });
      const requestToSearch = searchSuggestion || userQuery;
      const searchTool = initializeSearchTool();
      
      // For now, use the request directly as search term
      // In a full implementation, this would use an LLM to generate Sanskrit terms
      const searchTerm = requestToSearch;
      
      console.log('🔍 Performing vector search for:', searchTerm);
      // Perform vector search
      const searchResults = await searchTool.search(searchTerm, 5);
      console.log('🔍 Vector search results:', searchResults);
      console.log(`✅ Vector search completed: Found ${searchResults.length} results for "${searchTerm}"`);
      
      return {
        searchType: 'vector',
        searchTerm,
        results: searchResults,
        count: searchResults.length,
        success: true,
        message: `Vector search for "${searchTerm}" found ${searchResults.length} results`,
      };
    } catch (error) {
      console.error('❌ Vector search error:', error);
      return {
        searchType: 'vector',
        searchTerm: userQuery,
        results: [],
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Text Search Tool - Full-text search for specific terms
 */
export const textSearchTool = tool({
  description: 'Perform full-text search for specific Sanskrit words, deity names, or exact phrases',
  inputSchema: z.object({
    userQuery: z.string().describe('The user\'s original query'),
    searchSuggestion: z.string().optional().describe('Optional suggestion for search term from another agent'),
  }),
  execute: async ({ userQuery, searchSuggestion }) => {
    try {
      const requestToSearch = searchSuggestion || userQuery;
      const searchEngine = getSearchEngine();
      
      // For now, use the request directly as search term
      const searchTerm = requestToSearch;
      
      // Perform text search
      const textResults = await searchEngine.textSearch(searchTerm, 5);
      const searchResults = convertToSearchResults(textResults);
      
      return {
        searchType: 'text',
        searchTerm,
        results: searchResults,
        count: searchResults.length,
        success: true,
      };
    } catch (error) {
      console.error('Text search error:', error);
      return {
        searchType: 'text',
        searchTerm: userQuery,
        results: [],
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Book Context Search Tool - Direct verse lookup by reference
 */
export const bookContextSearchTool = tool({
  description: 'Perform direct verse lookup by book context reference. MUST use numeric format only (e.g., "1.1.1", "10.129", "7.50"). NEVER use "Mandala X Sukta Y" format.',
  inputSchema: z.object({
    userQuery: z.string().describe('The user\'s original query'),
    searchSuggestion: z.string().optional().describe('Optional verse reference in numeric format (e.g., "1.1.1")'),
  }),
  execute: async ({ userQuery, searchSuggestion }) => {
    try {
      const requestToSearch = searchSuggestion || userQuery;
      
      // Validate numeric format (X.Y or X.Y.Z)
      const numericPattern = /^\d+\.\d+(\.\d+)?$/;
      if (!numericPattern.test(requestToSearch.trim())) {
        console.warn(`⚠️ Invalid book context format: "${requestToSearch}". Must be numeric (e.g., "1.1.1")`);
        return {
          searchType: 'bookContext',
          searchTerm: requestToSearch,
          results: [],
          count: 0,
          success: false,
          error: 'Invalid format. Book context must be numeric (e.g., "1.1.1", not "Mandala 1 Sukta 1")',
        };
      }
      
      const searchTool = initializeSearchTool();
      
      // Use the search request directly as book context
      const bookContext = requestToSearch;
      
      // Perform book context search
      const searchResults = await searchTool.searchByBookContext(bookContext, 5);
      
      return {
        searchType: 'bookContext',
        searchTerm: bookContext,
        results: searchResults,
        count: searchResults.length,
        success: true,
      };
    } catch (error) {
      console.error('Book context search error:', error);
      return {
        searchType: 'bookContext',
        searchTerm: userQuery,
        results: [],
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * Hybrid Search Tool - Combines vector and text search
 */
export const hybridSearchTool = tool({
  description: 'Perform hybrid search combining vector similarity and text matching for comprehensive results',
  inputSchema: z.object({
    userQuery: z.string().describe('The user\'s original query'),
    searchSuggestion: z.string().optional().describe('Optional suggestion for search term from another agent'),
  }),
  execute: async ({ userQuery, searchSuggestion }) => {
    try {
      const requestToSearch = searchSuggestion || userQuery;
      const searchTool = initializeSearchTool();
      
      // For now, use the request directly as search term
      const searchTerm = requestToSearch;
      
      // Perform hybrid search
      const hybridResult = await searchTool.hybridSearch(searchTerm, 5);
      
      return {
        searchType: 'hybrid',
        searchTerm,
        results: hybridResult.results,
        count: hybridResult.results.length,
        success: true,
      };
    } catch (error) {
      console.error('Hybrid search error:', error);
      return {
        searchType: 'hybrid',
        searchTerm: userQuery,
        results: [],
        count: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});

/**
 * All search tools combined for easy import
 */
export const searchTools = {
  vectorSearch: vectorSearchTool,
  textSearch: textSearchTool,
  bookContextSearch: bookContextSearchTool,
  hybridSearch: hybridSearchTool,
};

// Note: analyzeResultsTool, translateAndSelectTool, and generateAnswerTool are defined in ai-sdk-orchestrator.ts
