# Multi-Agent System Architecture

This document describes the multi-agent system implementation for the Sanskrit Scholar AI application using proper AI SDK tool calling.

## Overview

The application uses a sophisticated multi-agent system powered by the Vercel AI SDK with native tool calling to provide comprehensive answers about Sanskrit literature. The system consists of five specialized agents that work together to process user queries with clear state transitions and proper verse count tracking.

## Architecture

### Agent Flow

```
User Query
    ↓
Orchestrator Agent (Classification & Routing with Tool Calling)
    ↓
├── Direct Response (Non-RigVeda queries)
│   └── END
└── RigVeda-Related Query
    ↓
    Searcher Agent (Search Method Selection with Tool Calling)
    ↓
    Analyzer Agent (Verse Evaluation with Tool Calling)
    ↓
    ├── Need More Search? → Back to Searcher Agent
    └── 5+ Relevant Verses Found → Translator Agent
    ↓
    Translator Agent (Translation & Selection with Tool Calling)
    ↓
    Generator Agent (Answer Generation with Proper Verse Filtering)
    ↓
    Stream to User
```

## Agents

### 1. Orchestrator Agent

**Purpose**: Classification, routing, and state management using AI SDK tool calling

**Tools**:
- `notify_ui(message: string)` - Send status updates to UI
- `route_to_searcher(userQuery: string, suggestion?: string)` - Route to Searcher
- `respond_to_user(message: string)` - Direct response for non-RigVeda queries

**Responsibilities**:
- Classify incoming user requests (RigVeda-related or not)
- Track relevant verse count from Analyzer responses
- Manage state transitions between agents
- Send UI notifications via tool calls
- Route queries to appropriate agents

**Key Features**:
- Uses AI SDK tool calling for all operations
- Tracks verse counts and iteration state
- Provides clear control flow between agents
- Handles both RigVeda and non-RigVeda queries

**Location**: `app/lib/agents/ai-sdk-orchestrator.ts`

### 2. Searcher Agent

**Purpose**: Intelligent search method selection using AI SDK tool calling

**Tools**:
- `vector_search(query: string)` - Semantic similarity search using embeddings
- `text_search(query: string)` - Full-text search for specific terms
- `bookContext_search(reference: string)` - Direct verse lookup by reference
- `hybrid_search(query: string)` - Combined vector + text search

**Responsibilities**:
- Analyze search requests to understand information needs
- Select the most appropriate search method based on query type
- Execute searches using the selected tool
- Return structured search results with relevance scores
- Support refined searches with additional context

**Key Features**:
- AI SDK tool calling for search method selection
- Multiple search strategies (vector, text, book context, hybrid)
- Sanskrit query translation and processing
- Semantic similarity detection to avoid duplicate searches

**Location**: `app/lib/agents/searcher.ts`

### 3. Analyzer Agent

**Purpose**: Verse evaluation and search iteration control using AI SDK tool calling

**Tools**:
- `evaluate_verses(evaluations: Array<{id, importance, isFiltered, reasoning}>)` - Mark verse relevance
- `request_more_search(searchQuery: string, reasoning: string)` - Request additional search
- `complete_analysis(reasoning: string)` - Mark analysis as complete

**Responsibilities**:
- Evaluate EACH verse independently for relevance (ignore search scores)
- Mark verses as filtered (irrelevant) or assign importance levels
- Count non-filtered verses as "relevant"
- Determine if more search is needed based on relevant verse count
- Request additional searches with intelligent Sanskrit terms

**Key Features**:
- AI SDK tool calling for verse evaluation
- Content-based relevance assessment (not search scores)
- Intelligent search term generation for additional searches
- Maximum 5 search iterations to prevent loops
- Clear verse count tracking for Orchestrator

**Location**: `app/lib/agents/analyzer.ts`

### 4. Translator Agent

**Purpose**: Translation and final verse selection using AI SDK tool calling

**Tools**:
- `translate_and_select(selections: Array<{id, translation, relevance, reasoning}>)` - Translate and select verses

**Responsibilities**:
- Translate Sanskrit verses to English
- Select most relevant verses (up to 5) for final answer
- Add translations to SearchResult objects
- NEVER requests more search (always proceeds to Generator)

**Key Features**:
- AI SDK tool calling for translation and selection
- Scholarly translation quality
- Intelligent verse selection based on relevance
- Always proceeds to Generator (no search loops)

**Location**: `app/lib/agents/translator.ts`

### 5. Generator Agent

**Purpose**: Final answer generation with proper verse filtering

**Verse Selection Logic**:
```typescript
const relevantVerses = searchResults.filter(r => !r.isFiltered);
const versesToUse = relevantVerses.length > 0 ? relevantVerses : searchResults;
```

**Responsibilities**:
- Generate comprehensive answers using ONLY provided verses
- Apply proper verse filtering (relevant vs all verses)
- Stream responses for better user experience
- Handle cases with no relevant verses

**Key Features**:
- Proper verse filtering logic
- Streaming answer generation
- Scholarly tone with proper citations
- Uses AI SDK's `streamText` without tools

**Location**: `app/lib/agents/generator.ts`

## Control Flow Example

```
User: "Tell me about hymns to Agni in the RigVeda"
  ↓
Orchestrator
  → notify_ui("Analyzing your query...")
  → route_to_searcher(userQuery, null)
  ↓
Searcher (iteration 1)
  → vector_search("अग्नि") 
  → Returns 5 verses
  ↓
Orchestrator
  → notify_ui("Found 5 verses, analyzing...")
  → route_to_analyzer(searchResults)
  ↓
Analyzer
  → evaluate_verses([...]) // Marks 2 as relevant, 3 as filtered
  → request_more_search("अग्नि स्तुति", "Need more direct hymns")
  ↓
Orchestrator (relevantCount=2, needs more)
  → notify_ui("Searching for more information...")
  → route_to_searcher(userQuery, "अग्नि स्तुति")
  ↓
Searcher (iteration 2)
  → vector_search("अग्नि स्तुति")
  → Returns 5 more verses (total: 10)
  ↓
Orchestrator
  → notify_ui("Analyzing additional results...")
  → route_to_analyzer(allSearchResults)
  ↓
Analyzer
  → evaluate_verses([...]) // Now 6 relevant total
  → complete_analysis("Sufficient verses found")
  ↓
Orchestrator (relevantCount=6, >= 5)
  → notify_ui("Translating verses...")
  → route_to_translator(searchResults)
  ↓
Translator
  → translate_and_select([...]) // Translates and selects 5 best
  ↓
Orchestrator
  → notify_ui("Generating comprehensive answer...")
  → route_to_generator(translatedResults)
  ↓
Generator
  → Filters: relevantVerses = searchResults.filter(r => !r.isFiltered)
  → Uses relevantVerses (6 verses) to generate answer
  → Streams response to user
```

## Technical Implementation

### AI SDK Tool Calling Pattern

All agents use the AI SDK's native tool calling feature:

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: this.model,
  prompt: "...",
  tools: {
    notify_ui: tool({
      description: "Send status update to UI",
      parameters: z.object({
        message: z.string()
      }),
      execute: async ({ message }) => {
        // Execute the tool
        return { success: true };
      }
    })
  },
  maxSteps: 10 // Allow multiple tool calls
});

// Process tool calls
for (const toolCall of result.toolCalls) {
  // Handle each tool call
}
```

### Orchestrator State Management

The Orchestrator tracks:
- `currentSearchResults: SearchResult[]`
- `relevantVerseCount: number` (updated after each Analyzer call)
- `searchIteration: number`
- `searchTermsHistory: string[]`

### Verse Count Logic

After Analyzer returns:
```typescript
const relevantVerses = searchResults.filter(r => !r.isFiltered);
const relevantVerseCount = relevantVerses.length;

if (relevantVerseCount >= 5) {
  // Proceed to translator
  orchestrator.route_to_translator(searchResults);
} else if (analyzer.requiresMoreSearch && iteration < maxIterations) {
  // Continue searching
  orchestrator.route_to_searcher(userQuery, analyzer.searchQuery);
} else {
  // Proceed with what we have
  orchestrator.route_to_translator(searchResults);
}
```

### WebLLM Integration

The system uses a custom provider adapter (`app/lib/webllm-provider.ts`) to integrate our existing WebLLM engine with the AI SDK. This approach:

- Reuses the already-loaded model from `useWebLLM` (no duplicate engines)
- Maintains our custom loading UI and progress tracking
- Seamless use of browser-based LLMs
- No backend dependencies
- Full privacy (all processing happens client-side)
- Compatibility with AI SDK's streaming capabilities

**Note**: We use a custom provider instead of `@built-in-ai/web-llm` to avoid creating duplicate engine instances. Our approach ensures the model is loaded once and shared between the chat interface and agent system.

### AI SDK Agent Hook

The `useAISDKAgent` hook (`app/hooks/useAISDKAgent.ts`) orchestrates the entire agent system:

```typescript
const {
  messages,           // All conversation messages
  isProcessing,       // Processing state
  currentStep,        // Current processing step
  processUserMessage, // Main entry point for queries
  resetConversation,  // Clear conversation
} = useAISDKAgent({ model });
```

### UI Components

- **AISDKChatInterface**: Main chat interface with agent status indicators
- **AgentChatMessage**: Renders different message types with appropriate styling
- System messages appear as blue informational badges
- Agent status is shown in the header with animated indicators

## Configuration

### Search Iterations

The Analyzer Agent has a maximum of 5 search iterations to prevent infinite loops:

```typescript
private readonly maxSearchIterations = 5;
```

### Temperature Settings

- **Classification (Orchestrator)**: 0.3 (more deterministic)
- **Search (Searcher)**: 0.3 (balanced)
- **Analysis (Analyzer)**: 0.3 (more deterministic)
- **Translation (Translator)**: 0.3 (more deterministic)
- **Generation (Generator)**: 0.6 (more creative)

### Verse Count Threshold

The system proceeds to translation when 5 or more relevant verses are found:

```typescript
if (relevantVerseCount >= 5) {
  // Proceed to translator
}
```

## Key Improvements

### 1. Proper AI SDK Tool Calling
- All agents now use AI SDK's native tool calling instead of custom JSON parsing
- Clear tool definitions with proper parameter validation using Zod schemas
- Better error handling and type safety

### 2. Clear Agent Responsibilities
- **Orchestrator**: Classification, routing, and state management
- **Searcher**: Search method selection and execution
- **Analyzer**: Verse evaluation and search iteration control
- **Translator**: Translation and final verse selection
- **Generator**: Answer generation with proper verse filtering

### 3. Proper Verse Count Tracking
- Orchestrator tracks relevant verse count from Analyzer responses
- Clear decision logic for when to proceed to translation
- Prevents infinite search loops

### 4. Better Control Flow
- Clear state transitions between agents
- Proper UI notifications via tool calls
- Handles both RigVeda and non-RigVeda queries appropriately

## Performance Considerations

- All processing happens in the browser using WebLLM
- Streaming provides immediate user feedback
- Agent status updates keep users engaged during processing
- Maximum search iterations prevent excessive processing time
- Proper verse filtering reduces unnecessary processing

## Error Handling

- AI SDK tool calling provides better error handling than custom JSON parsing
- Graceful degradation if tool calls fail
- User-friendly error messages
- Automatic retry mechanisms in the AI SDK layer
- Fallback responses for each agent

## Testing

To test the multi-agent system:

1. **RigVeda Query**: Ask about RigVeda hymns → Should route through all agents
2. **Non-RigVeda Query**: Ask about modern topics → Should get polite decline
3. **Complex Query**: Ask question requiring multiple searches → Should see refinement
4. **Simple Query**: Ask basic question → Should get direct answer
5. **No Results Query**: Ask about non-existent content → Should handle gracefully

## Dependencies

- `ai`: Vercel AI SDK for agent orchestration and tool calling
- `@ai-sdk/provider`: Provider interface types
- `@mlc-ai/web-llm`: Browser-based LLM runtime
- `zod`: Schema validation for tool parameters

