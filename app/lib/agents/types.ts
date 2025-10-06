export type AgentRole = 'orchestrator' | 'searcher' | 'generator';

export type MessageType = 
  | 'user'           // User's original message
  | 'system'         // System/status message for UI
  | 'assistant'      // Final assistant response
  | 'agent-internal' // Internal agent-to-agent communication
  | 'thinking'       // Agent thinking/processing status
  | 'verses';        // Search results/verses display

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
  };
}

export interface SearchResult {
  id: string;
  title: string;
  content?: string; // Make optional to handle null/undefined cases
  relevance: number;
  source?: string;
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
}

