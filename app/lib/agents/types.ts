export type AgentRole = 'orchestrator' | 'searcher' | 'analyzer' | 'translator' | 'generator';

export type MessageType = 
  | 'user'           // User's original message
  | 'system'         // System/status message for UI
  | 'assistant'      // Final assistant response
  | 'agent-internal' // Internal agent-to-agent communication
  | 'thinking'       // Agent thinking/processing status
  | 'verses'         // Search results/verses display
  | 'search-status'  // Search iteration status
  | 'search-results'; // Search results from specific iteration

export type ImportanceLevel = 'high' | 'medium' | 'low';

export interface HighlightSection {
  start: number;
  end: number;
  importance: ImportanceLevel;
}

export interface AgentMessage {
  id: string;
  role: AgentRole | 'user' | 'assistant';
  messageType: MessageType;
  content: string;
  timestamp: Date;
  metadata?: {
    targetAgent?: AgentRole;
    fromAgent?: AgentRole;
    searchResults?: SearchResult[];
    isComplete?: boolean;
    requiresMoreSearch?: boolean;
    searchQuery?: string;
    searchIteration?: number;
    maxSearchIterations?: number;
    highlightSections?: HighlightSection[];
    verseImportance?: Record<string, ImportanceLevel>; // Map verse ID to importance
    searchTerm?: string; // The specific search term used for this iteration
    avgRelevanceScore?: number; // Average relevance score for this search iteration
  };
}

export interface SearchResult {
  id: string;
  title: string;
  content?: string; // Sanskrit text
  translation?: string; // English translation
  relevance: number;
  source?: string;
  bookContext?: string; // e.g., "7.50.1" - the specific verse reference
  importance?: ImportanceLevel; // Assigned by analyzer
  isFiltered?: boolean; // Marked as filtered by analyzer
}

export interface AgentContext {
  userQuery: string;
  conversationHistory: AgentMessage[];
  currentAgent: AgentRole;
  searchResults?: SearchResult[];
}

export interface AgentResponse {
  content: string;
  nextAgent?: AgentRole;
  isComplete: boolean;
  statusMessage?: string;
  searchResults?: SearchResult[];
  requiresMoreSearch?: boolean;
  searchQuery?: string;
  highlightSections?: HighlightSection[];
  verseImportance?: Record<string, ImportanceLevel>;
  metadata?: {
    newResults?: SearchResult[];
    allResults?: SearchResult[];
  };
}

