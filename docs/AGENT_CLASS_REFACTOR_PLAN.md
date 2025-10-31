# AI SDK Agent Class Refactor Plan

## Why Use the Agent Class?

Based on the [AI SDK Agents documentation](https://ai-sdk.dev/docs/agents/overview), we should be using the `Agent` class instead of manually implementing tool calling with `generateText`. Here's why:

### Current Problems with Manual Implementation

1. **Boilerplate Code**: We're manually managing loops, message arrays, and tool call processing
2. **Complex State Management**: Each agent has to handle its own tool calling logic
3. **Error Handling**: Manual error handling for tool calls and state transitions
4. **Maintenance**: Changes require updating multiple places in the code

### Benefits of Using Agent Class

1. **Reduces Boilerplate**: The Agent class automatically manages loops and message arrays
2. **Improves Reusability**: Define once, use throughout the application
3. **Simplifies Maintenance**: Single place to update agent configuration
4. **Automatic Context Management**: Maintains conversation history and decides what the model sees
5. **Built-in Stopping Conditions**: Uses `stopWhen` to determine when the task is complete
6. **Better Error Handling**: Built-in error handling and recovery

## Current vs. Proposed Architecture

### Current Architecture (Manual Tool Calling)
```typescript
// Each agent manually implements tool calling
const result = await generateText({
  model: this.model,
  prompt: prompt,
  tools: {
    tool_name: tool({
      description: "...",
      parameters: z.object({...}),
      execute: async ({...}) => {...}
    })
  }
});

// Manual tool call processing
for (const toolCall of result.toolCalls) {
  if (toolCall.toolName === 'tool_name') {
    // Handle tool call
  }
}
```

### Proposed Architecture (Agent Class)
```typescript
// Define agent once with tools
const agent = new Agent({
  model: this.model,
  tools: {
    tool_name: tool({
      description: "...",
      inputSchema: z.object({...}),
      execute: async ({...}) => {...}
    })
  },
  stopWhen: stepCountIs(10)
});

// Use agent - automatic loop management
const result = await agent.generate({
  prompt: prompt
});
```

## Implementation Plan

### 1. Orchestrator Agent Refactor

**Current**: Manual `generateText` with tool calling
**Proposed**: Use `Agent` class with routing tools

```typescript
export class AISDKOrchestrator {
  private orchestratorAgent: Agent;
  
  constructor(model: LanguageModelV2) {
    this.orchestratorAgent = new Agent({
      model: this.model,
      tools: {
        notify_ui: tool({
          description: "Send status update to UI",
          inputSchema: z.object({
            message: z.string()
          }),
          execute: async ({ message }) => {
            this.onStepUpdate?.({ type: 'notification', message });
            return { success: true };
          }
        }),
        route_to_searcher: tool({
          description: "Route query to Searcher agent",
          inputSchema: z.object({
            userQuery: z.string(),
            suggestion: z.string().optional()
          }),
          execute: async ({ userQuery, suggestion }) => {
            // Handle routing logic
            return { nextAgent: 'searcher', userQuery, suggestion };
          }
        }),
        respond_to_user: tool({
          description: "Respond directly to user for non-RigVeda queries",
          inputSchema: z.object({
            message: z.string()
          }),
          execute: async ({ message }) => {
            return { response: message, isComplete: true };
          }
        })
      },
      stopWhen: stepCountIs(10)
    });
  }
  
  private async runOrchestrator(userQuery: string) {
    const result = await this.orchestratorAgent.generate({
      prompt: orchestratorPrompt
    });
    
    // Agent class automatically handles tool calls and loops
    return this.processAgentResult(result);
  }
}
```

### 2. Searcher Agent Refactor

**Current**: Manual tool calling for search method selection
**Proposed**: Use `Agent` class with search tools

```typescript
export class SearcherAgent {
  private searcherAgent: Agent;
  
  constructor(model: LanguageModelV2) {
    this.searcherAgent = new Agent({
      model: this.model,
      tools: {
        vector_search: tool({
          description: "Semantic similarity search using embeddings",
          inputSchema: z.object({
            query: z.string()
          }),
          execute: async ({ query }) => {
            return await this.executeVectorSearch(query);
          }
        }),
        text_search: tool({
          description: "Full-text search for specific terms",
          inputSchema: z.object({
            query: z.string()
          }),
          execute: async ({ query }) => {
            return await this.executeTextSearch(query);
          }
        }),
        bookContext_search: tool({
          description: "Direct verse lookup by reference",
          inputSchema: z.object({
            reference: z.string()
          }),
          execute: async ({ reference }) => {
            return await this.executeBookContextSearch(reference);
          }
        }),
        hybrid_search: tool({
          description: "Combined vector and text search",
          inputSchema: z.object({
            query: z.string()
          }),
          execute: async ({ query }) => {
            return await this.executeHybridSearch(query);
          }
        })
      },
      stopWhen: stepCountIs(5)
    });
  }
  
  async processSearchRequest(userQuery: string, searchSuggestion?: string) {
    const result = await this.searcherAgent.generate({
      prompt: searcherPrompt
    });
    
    // Agent class automatically selects and executes the right search tool
    return this.processSearchResult(result);
  }
}
```

### 3. Analyzer Agent Refactor

**Current**: Manual tool calling for verse evaluation
**Proposed**: Use `Agent` class with analysis tools

```typescript
export class AnalyzerAgent {
  private analyzerAgent: Agent;
  
  constructor(model: LanguageModelV2) {
    this.analyzerAgent = new Agent({
      model: this.model,
      tools: {
        evaluate_verses: tool({
          description: "Evaluate each verse for relevance and assign importance levels",
          inputSchema: z.object({
            evaluations: z.array(z.object({
              id: z.string(),
              importance: z.enum(['high', 'medium', 'low']),
              isFiltered: z.boolean(),
              reasoning: z.string()
            }))
          }),
          execute: async ({ evaluations }) => {
            return await this.processVerseEvaluations(evaluations);
          }
        }),
        request_more_search: tool({
          description: "Request additional search with a new Sanskrit term",
          inputSchema: z.object({
            searchQuery: z.string(),
            reasoning: z.string()
          }),
          execute: async ({ searchQuery, reasoning }) => {
            return await this.requestAdditionalSearch(searchQuery, reasoning);
          }
        }),
        complete_analysis: tool({
          description: "Mark analysis as complete and proceed to next step",
          inputSchema: z.object({
            reasoning: z.string()
          }),
          execute: async ({ reasoning }) => {
            return await this.completeAnalysis(reasoning);
          }
        })
      },
      stopWhen: stepCountIs(3)
    });
  }
  
  async analyze(userQuery: string, searchResults: SearchResult[], iterationCount: number, previousSearchTerms: string[]) {
    const result = await this.analyzerAgent.generate({
      prompt: analysisPrompt
    });
    
    // Agent class automatically handles verse evaluation and decision making
    return this.processAnalysisResult(result);
  }
}
```

### 4. Translator Agent Refactor

**Current**: Manual tool calling for translation and selection
**Proposed**: Use `Agent` class with translation tools

```typescript
export class TranslatorAgent {
  private translatorAgent: Agent;
  
  constructor(model: LanguageModelV2) {
    this.translatorAgent = new Agent({
      model: this.model,
      tools: {
        translate_and_select: tool({
          description: "Translate Sanskrit verses and select the most relevant ones",
          inputSchema: z.object({
            selections: z.array(z.object({
              id: z.string(),
              translation: z.string(),
              relevance: z.enum(['high', 'medium', 'low']),
              reasoning: z.string()
            }))
          }),
          execute: async ({ selections }) => {
            return await this.processTranslations(selections);
          }
        })
      },
      stopWhen: stepCountIs(1)
    });
  }
  
  async translateAndEvaluate(userQuery: string, searchResults: SearchResult[]) {
    const result = await this.translatorAgent.generate({
      prompt: translationPrompt
    });
    
    // Agent class automatically handles translation and selection
    return this.processTranslationResult(result);
  }
}
```

## Key Benefits of This Refactor

### 1. **Automatic Loop Management**
- No more manual `for` loops processing tool calls
- Agent class handles the execution loop automatically
- Built-in stopping conditions with `stopWhen`

### 2. **Simplified State Management**
- Agent class maintains conversation history
- Automatic context management
- No need to manually track tool call results

### 3. **Better Error Handling**
- Built-in error handling and recovery
- Automatic retry logic for failed tool calls
- Graceful degradation when tools fail

### 4. **Improved Maintainability**
- Single place to define agent configuration
- Easier to add new tools or modify existing ones
- Consistent pattern across all agents

### 5. **Enhanced Reusability**
- Define agent once, use throughout application
- Easy to create specialized agents for different tasks
- Better separation of concerns

## Migration Strategy

### Phase 1: Orchestrator Agent
1. Refactor `AISDKOrchestrator` to use `Agent` class
2. Test classification and routing functionality
3. Verify UI notifications work correctly

### Phase 2: Searcher Agent
1. Refactor `SearcherAgent` to use `Agent` class
2. Test search method selection
3. Verify all search types work correctly

### Phase 3: Analyzer Agent
1. Refactor `AnalyzerAgent` to use `Agent` class
2. Test verse evaluation and search iteration logic
3. Verify verse count tracking works correctly

### Phase 4: Translator Agent
1. Refactor `TranslatorAgent` to use `Agent` class
2. Test translation and selection functionality
3. Verify proper verse filtering

### Phase 5: Integration Testing
1. Test complete workflow with all agents
2. Verify state transitions work correctly
3. Test error handling and edge cases

## Conclusion

Using the AI SDK `Agent` class will significantly improve our multi-agent system by:

- **Reducing complexity**: Less boilerplate code and manual state management
- **Improving reliability**: Built-in error handling and loop management
- **Enhancing maintainability**: Single place to configure each agent
- **Better performance**: Optimized execution and context management

The refactor aligns with AI SDK best practices and will make our system more robust and easier to maintain.
