# RigVeda Multi-Agent Architecture

## Overview

This document defines the architecture for the RigVeda question-answering system. The system uses a multi-agent architecture with **code-based orchestration** (NOT LLM-based coordination). Each agent has a specific role and communicates using **strict JSON schemas**.

## Orchestrator Flow

```javascript
on orchestrator_agent(user_query) {
    current_iteration = 0;
    total_verses_found = 0;
    found_verses = [];
    suggestion = undefined;
    
    // Step 1: Check if query is about RigVeda
    if (user_query is NOT about the RigVeda) {
        return "Sorry, Not about the RigVeda";
    }
    
    // Step 2: Iterative search-analyze loop (max 5 iterations)
    while (current_iteration < 5) {
        // 2a. Call SEARCHER agent
        searcher_result = call(searcher_agent, {
            userQuery: user_query,
            searchSuggestion: suggestion
        });
        
        // 2b. Call ANALYZER agent
        analyzer_result = call(analyzer_agent, {
            userQuery: user_query,
            searchResults: searcher_result.searchResults,
            iterationCount: current_iteration,
            previousSearchTerms: [all previous search terms]
        });
        
        // 2c. Accumulate relevant verses
        if (analyzer_result.relevantVerses is not empty) {
            total_verses_found += analyzer_result.relevantVerses.length;
            found_verses.push(...analyzer_result.relevantVerses);
        }
        
        // 2d. Check stopping conditions
        if (total_verses_found >= 5) {
            break; // Proceed to translation
        }
        
        // 2e. Update suggestion for next iteration
        suggestion = analyzer_result.searchSuggestion;
        current_iteration++;
    }
    
    // Step 3: Check if we found any verses
    if (total_verses_found === 0) {
        return "Sorry, Not enough information to answer the question";
    }
    
    // Step 4: Call TRANSLATOR agent
    translator_result = call(translator_agent, {
        userQuery: user_query,
        verses: found_verses
    });
    
    // Step 5: Call GENERATOR agent
    generator_result = call(generator_agent, {
        userQuery: user_query,
        translatedVerses: translator_result.translatedVerses
    });
    
    // Step 6: Return final answer
    return generator_result.response;
}
```

## Agent JSON Schemas

### SEARCHER AGENT

**Purpose:** Find relevant verses in the RigVeda corpus

**Input Schema:**
```typescript
{
  userQuery: string;           // The original user question
  searchSuggestion?: string;   // Optional Sanskrit term from analyzer
}
```

**Output Schema:**
```typescript
{
  success: boolean;            // Whether search completed successfully
  searchResults: SearchResult[]; // Array of found verses
  searchType: string;          // Type: "vector" | "text" | "hybrid" | "bookContext"
  searchTerm: string;          // The actual term used for searching
  error?: string;              // Error message if search failed
}
```

### ANALYZER AGENT

**Purpose:** Evaluate search results and determine if more search is needed

**Input Schema:**
```typescript
{
  userQuery: string;           // The original user question
  searchResults: SearchResult[]; // Verses to analyze
  iterationCount: number;      // Current iteration (0-4)
  previousSearchTerms: string[]; // Terms already searched
}
```

**Output Schema:**
```typescript
{
  success: boolean;            // Whether analysis completed successfully
  relevantVerses: SearchResult[]; // Verses marked as relevant
  filteredVerses: SearchResult[]; // Verses marked as irrelevant
  needsMoreSearch: boolean;    // Whether more iterations needed
  searchSuggestion?: string;   // Sanskrit term to search next
  error?: string;              // Error message if analysis failed
}
```

### TRANSLATOR AGENT

**Purpose:** Translate Sanskrit verses to English

**Input Schema:**
```typescript
{
  userQuery: string;           // The original user question (for context)
  verses: SearchResult[];      // Verses to translate
}
```

**Output Schema:**
```typescript
{
  success: boolean;            // Whether translation completed successfully
  translatedVerses: SearchResult[]; // Verses with translations added
  error?: string;              // Error message if translation failed
}
```

### GENERATOR AGENT

**Purpose:** Generate comprehensive answer from translated verses

**Input Schema:**
```typescript
{
  userQuery: string;           // The original user question
  translatedVerses: SearchResult[]; // Translated verses to use
}
```

**Output Schema:**
```typescript
{
  success: boolean;            // Whether generation completed successfully
  response: string;            // The generated answer text
  error?: string;              // Error message if generation failed
}
```

## Communication Rules

1. **Agents communicate ONLY through JSON** - No other form of communication
2. **Code-based orchestration** - The orchestrator coordinates in TypeScript code, NOT through LLM calls
3. **Strict schema validation** - All inputs/outputs are validated against schemas
4. **Error handling** - Each agent must return `success: false` on errors with an `error` field
5. **No inter-agent communication** - Agents cannot call each other; only the orchestrator calls agents

## SearchResult Type

```typescript
interface SearchResult {
  title: string;               // Verse title/reference
  content: string;             // Sanskrit text
  relevance: number;           // Relevance score (0-1)
  source: string;              // Source book/mandala
  bookContext: string;         // Full reference (e.g., "10.129.1")
  translation?: string;        // English translation (added by translator)
  importance?: 'high' | 'medium' | 'low'; // Importance (added by analyzer)
  isFiltered?: boolean;        // Whether verse is filtered out (added by analyzer)
}
```