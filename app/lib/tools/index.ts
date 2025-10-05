/**
 * Tools Module
 * 
 * Exports all tools available for the multi-agent system
 */

export { SearchTool, getSearchTool } from './search-tool';
export type { SearchToolConfig } from './search-tool';

// Re-export embedding service for convenience
export { 
  EmbeddingService, 
  getEmbeddingService, 
  DEFAULT_EMBEDDING_CONFIG 
} from '../embedding-service';
export type { EmbeddingServiceConfig } from '../embedding-service';

