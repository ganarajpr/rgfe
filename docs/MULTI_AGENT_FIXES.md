# Multi-Agent System Fixes

## Date: October 6, 2025

## Issues Addressed

### 1. Search Not Finding Results
**Problem**: The multi-agent system was generating search terms in English, but the corpus contains Sanskrit/Devanagari text, resulting in no search results.

**Fix**: 
- Updated `SearcherAgent.generateSearchTerms()` to explicitly request search terms in Sanskrit/Devanagari script
- Added Devanagari script validation (`/[\u0900-\u097F]/`) to ensure generated terms are in proper script
- Implemented fallback to translation service if Sanskrit terms cannot be generated
- Enhanced prompts to emphasize the requirement for Sanskrit/Devanagari output

**Files Modified**:
- `app/lib/agents/searcher.ts` (lines 80-135)

### 2. JSON Responses Visible to Users
**Problem**: Internal agent analysis JSON responses were being displayed to users in the UI, creating a poor user experience.

**Fix**:
- Modified `GeneratorAgent.checkIfNeedsMoreSearch()` to set `content: ''` for internal search requests
- Added filtering in `useMultiAgent.processGeneratorFlow()` to prevent status messages containing JSON from being displayed
- Added explicit note in analysis prompt that response will not be shown to user
- Enhanced logging to console instead of user-facing messages

**Files Modified**:
- `app/lib/agents/generator.ts` (lines 74-170)
- `app/hooks/useMultiAgent.ts` (lines 264-312)

### 3. Generator Using Own Knowledge Instead of Search Results
**Problem**: The generator agent was answering questions using its own knowledge base rather than strictly using information from search results.

**Fix**:
- Updated `GENERATOR_SYSTEM_PROMPT` with CRITICAL RULES emphasizing strict adherence to search results
- Modified `streamAnswer()` method to explicitly check for empty results and return early
- Enhanced generation prompt with explicit instructions to not use general knowledge
- Added instructions to clearly state when search results are insufficient

**Files Modified**:
- `app/lib/agents/generator.ts` (lines 5-38, 191-242)

### 4. Max Iterations Not Working Correctly
**Problem**: The maximum search iteration logic was set to 2, but user expected 3 total back-and-forth iterations.

**Fix**:
- Changed `maxSearchIterations` from 2 to 3 to allow 4 total search attempts (1 initial + 3 refinements)
- Added enhanced logging to show current iteration count and maximum
- Updated iteration counter display in refined search requests

**Files Modified**:
- `app/lib/agents/generator.ts` (line 42)
- `app/hooks/useMultiAgent.ts` (lines 279-286)

## Implementation Details

### Search Term Generation Flow

1. User enters query in English (or any language)
2. Orchestrator classifies and routes to Searcher
3. Searcher calls `generateSearchTerms()` which:
   - Prompts LLM to generate Sanskrit/Devanagari search terms
   - Validates terms contain Devanagari script
   - Falls back to translation service if needed
4. Multiple Sanskrit search terms are generated
5. Each term is used for semantic vector search
6. Results are aggregated and deduplicated

### Generator Analysis Flow

1. Generator receives search results
2. Calls `checkIfNeedsMoreSearch()` internally (NOT shown to user)
3. LLM analyzes if results are sufficient
4. If insufficient AND iteration count < 3:
   - Validates search query is in Sanskrit/Devanagari
   - Returns internal request to route back to Searcher
   - Status message shown to user (but not JSON)
5. If sufficient OR max iterations reached:
   - Proceeds to generate final answer
   - Only uses information from search results
   - Clearly states if results are insufficient

### Answer Generation Flow

1. Generator checks if search results exist
2. If no results: Returns apologetic message immediately
3. If results exist: Generates answer with strict prompt:
   - CRITICAL: Use ONLY provided sources
   - Do NOT fill gaps with general knowledge
   - Clearly state if information is missing
4. Streams answer to user with markdown formatting

## Testing Recommendations

1. **Test Sanskrit Search Terms**:
   - Try query: "who are the participants in the dasharajna war"
   - Verify console shows Sanskrit search terms being generated
   - Check that search returns results

2. **Test No JSON in UI**:
   - Monitor UI for any JSON-like output
   - Verify only clean status messages appear
   - Check that internal analysis stays in console logs

3. **Test Answer Quality**:
   - Verify answers cite specific sources
   - Confirm no hallucinated information
   - Check that insufficient results are handled gracefully

4. **Test Iteration Limits**:
   - Monitor console for iteration counts
   - Verify refinement stops after 3 iterations
   - Check that final answer is generated even if results are limited

## Expected Behavior

### Successful Search Flow
```
User Query → 
  Orchestrator (analyzes) → 
    Searcher (generates Sanskrit terms) → 
      Vector Search (finds relevant verses) → 
        Generator (analyzes sufficiency) → 
          [If sufficient] Final Answer (from sources only)
          [If insufficient, iteration < 3] → Searcher (refined Sanskrit term) → ...
          [If insufficient, iteration >= 3] → Final Answer (explaining insufficiency)
```

### Console Output Structure
```
🤖 ORCHESTRATOR REQUEST
🔍 SEARCHER REQUEST
   Generated Sanskrit search terms:
   1. "Sanskrit term 1"
   2. "Sanskrit term 2"
🔍 Vector search results: X results found
📝 GENERATOR REQUEST
🤖 Generator analysis response: {...} (JSON, not shown to user)
📝 GENERATOR STREAMING FINAL ANSWER
```

### User-Visible Messages
- "Analyzing your query..."
- "Generating multiple search approaches..."
- "Searching: [Sanskrit term] (1/3)"
- "Found X relevant verses from Sanskrit texts."
- "Analyzing search results and generating answer..."
- [Final answer with citations]

## Notes

- All internal JSON analysis is logged to console for debugging
- Users only see clean status messages and final answers
- Sanskrit search terms ensure better matching with corpus content
- Maximum 3 refinement iterations prevents infinite loops
- Strict source-only answering maintains scholarly accuracy
