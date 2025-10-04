# Multi-Agent System Architecture

This document describes the multi-agent system implementation for the Sanskrit Scholar AI application.

## Overview

The application uses a sophisticated multi-agent system powered by the Vercel AI SDK to provide comprehensive answers about Sanskrit literature. The system consists of three specialized agents that work together to process user queries.

## Architecture

### Agent Flow

```
User Query
    ↓
Orchestrator Agent (Classification & Routing)
    ↓
├── Direct Response (Non-Sanskrit queries)
│   └── END
└── Sanskrit-Related Query
    ↓
    Searcher Agent (Information Retrieval)
    ↓
    Generator Agent (Answer Generation)
    ↓
    ├── Need More Info? → Back to Searcher Agent
    └── Answer Complete → Stream to User
```

## Agents

### 1. Orchestrator Agent

**Purpose**: Classification and routing of user queries

**Responsibilities**:
- Analyze incoming user requests
- Classify whether the query is related to Sanskrit literature
- Route Sanskrit-related queries to the Searcher Agent
- Provide direct responses for non-Sanskrit queries
- Coordinate communication between agents
- Send status updates to the UI

**Key Features**:
- Uses LLM-based classification for intelligent routing
- Provides polite decline for off-topic queries
- Maintains conversation context

**Location**: `app/lib/agents/orchestrator.ts`

### 2. Searcher Agent

**Purpose**: Information retrieval and search functionality

**Responsibilities**:
- Analyze user queries to understand information needs
- Generate relevant search queries
- Simulate searching through a Sanskrit literature knowledge base
- Return structured search results with relevance scores
- Support refined searches with additional context

**Key Features**:
- Generates 3-5 high-quality search results per query
- Supports iterative refinement for better results
- Includes fallback mechanisms for error handling
- Returns structured data (title, content, relevance, source)

**Location**: `app/lib/agents/searcher.ts`

**Note**: Currently uses LLM-generated simulated results. In production, this should be replaced with actual database or vector search integration.

### 3. Generator Agent

**Purpose**: Comprehensive answer generation

**Responsibilities**:
- Analyze search results for completeness
- Determine if additional searches are needed
- Request refined searches when information gaps exist
- Generate comprehensive, well-sourced answers
- Stream responses for better user experience

**Key Features**:
- Intelligent gap detection in search results
- Iterative search refinement (max 2 iterations to prevent loops)
- Streaming answer generation
- Scholarly tone with proper citations
- Context-aware response synthesis

**Location**: `app/lib/agents/generator.ts`

## Message Flow

### Message Types

1. **User Messages**: Original queries from the user
2. **System Messages**: Status updates and agent notifications
3. **Assistant Messages**: Final responses to the user
4. **Agent-Internal Messages**: Communication between agents (not displayed)

### Status Updates

The system provides real-time status updates to keep users informed:

- 🤖 "Analyzing your query..." - Orchestrator classifying
- 🔍 "Searching for relevant information..." - Searcher working
- ✅ "Found X relevant sources" - Search complete
- 📝 "Generating comprehensive answer..." - Generator working
- ✅ "Answer complete" - Process finished

## Technical Implementation

### WebLLM Integration

The system uses a custom provider adapter (`app/lib/webllm-provider.ts`) to integrate our existing WebLLM engine with the AI SDK. This approach:

- Reuses the already-loaded model from `useWebLLM` (no duplicate engines)
- Maintains our custom loading UI and progress tracking
- Seamless use of browser-based LLMs
- No backend dependencies
- Full privacy (all processing happens client-side)
- Compatibility with AI SDK's streaming capabilities

**Note**: We use a custom provider instead of `@built-in-ai/web-llm` to avoid creating duplicate engine instances. Our approach ensures the model is loaded once and shared between the chat interface and agent system.

### Multi-Agent Hook

The `useMultiAgent` hook (`app/hooks/useMultiAgent.ts`) orchestrates the entire agent system:

```typescript
const {
  messages,           // All conversation messages
  isProcessing,       // Processing state
  currentAgent,       // Currently active agent
  processUserMessage, // Main entry point for queries
  resetConversation,  // Clear conversation
} = useMultiAgent({ model });
```

### UI Components

- **AgentChatInterface**: Main chat interface with agent status indicators
- **AgentChatMessage**: Renders different message types with appropriate styling
- System messages appear as blue informational badges
- Agent status is shown in the header with animated indicators

## Data Flow Example

1. **User asks**: "Explain the concept of Dharma in the Bhagavad Gita"

2. **Orchestrator**: 
   - Classifies as Sanskrit-related ✓
   - Status: "Analyzing your query..."
   - Routes to Searcher

3. **Searcher**:
   - Status: "Searching for relevant information..."
   - Generates search results about Dharma and Bhagavad Gita
   - Returns 3-5 relevant sources
   - Status: "Found 5 relevant sources"

4. **Generator**:
   - Status: "Analyzing search results..."
   - Evaluates if results are sufficient ✓
   - Status: "Generating comprehensive answer..."
   - Streams response with citations
   - Status: "Answer complete"

5. **User sees**: Comprehensive answer with sources, streamed in real-time

## Configuration

### Search Iterations

The Generator Agent has a maximum of 2 search iterations to prevent infinite loops:

```typescript
private readonly maxSearchIterations = 2;
```

### Temperature Settings

- **Classification (Orchestrator)**: 0.3 (more deterministic)
- **Search (Searcher)**: 0.4 (balanced)
- **Generation (Generator)**: 0.6 (more creative)

## Future Enhancements

1. **Real Search Integration**: Replace simulated search with actual vector database
2. **Citation Tracking**: Link generated content to specific search results
3. **Context Memory**: Maintain conversation history across queries
4. **Advanced Tool Calling**: Add tools for specific Sanskrit text lookups
5. **Multi-modal Support**: Handle images of Sanskrit texts
6. **Fact Verification**: Cross-check generated content against sources

## Performance Considerations

- All processing happens in the browser using WebLLM
- Streaming provides immediate user feedback
- Agent status updates keep users engaged during processing
- Maximum search iterations prevent excessive processing time

## Error Handling

- Fallback search results if LLM fails to generate JSON
- Graceful degradation if classification fails
- User-friendly error messages
- Automatic retry mechanisms in the AI SDK layer

## Testing

To test the multi-agent system:

1. **Sanskrit Query**: Ask about Sanskrit texts → Should route through all agents
2. **Non-Sanskrit Query**: Ask about modern topics → Should get polite decline
3. **Complex Query**: Ask question requiring multiple searches → Should see refinement
4. **Simple Query**: Ask basic question → Should get direct answer

## Dependencies

- `ai`: Vercel AI SDK for agent orchestration
- `@ai-sdk/provider`: Provider interface types
- `@mlc-ai/web-llm`: Browser-based LLM runtime
- `zod`: Schema validation (optional, installed for future use)

