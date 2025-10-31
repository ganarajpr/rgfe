# Analyzer Strict Mode Implementation

## Problem

The analyzer was too lenient and was approving all verses passed to it:
- ❌ Used simple string matching (`content.includes(term)`) which was too permissive
- ❌ Didn't have access to the search query for context
- ❌ Didn't explicitly ignore search relevance scores
- ❌ Accepted partial matches too easily

## Solution

Replaced simple string matching with **strict LLM-based evaluation** that:

1. ✅ **Uses LLM for semantic analysis** - Evaluates verses based on actual meaning, not keywords
2. ✅ **Receives search query** - Now gets both user query AND the search query that was used
3. ✅ **Explicitly ignores relevance scores** - Search scores are not included in analysis
4. ✅ **Strict evaluation criteria** - Verses must actually relate to the query, not just contain similar words

## Changes Made

### 1. Updated Analyzer Method Signature

**Before:**
```typescript
async analyze(
  userQuery: string,
  searchResults: SearchResult[],
  iterationCount: number,
  previousSearchTerms: string[] = []
): Promise<AgentResponse>
```

**After:**
```typescript
async analyze(
  userQuery: string,
  searchQuery: string,        // NEW: The search term that was used
  searchResults: SearchResult[],
  iterationCount: number,
  previousSearchTerms: string[] = []
): Promise<AgentResponse>
```

### 2. Replaced String Matching with LLM Evaluation

**Before:** Simple keyword matching
```typescript
const hasDirectMatch = content.includes(term);
const hasPartialMatch = content.includes(term + 's');
const sanskritMatches = this.checkSanskritRelevance(content, userQuery);
// Too permissive - accepts any match
```

**After:** LLM-based semantic evaluation
```typescript
const analysisPrompt = `...STRICT EVALUATION RULES...`;
const result = await generateText({ model, prompt, temperature: 0.3 });
const llmEvaluation = JSON.parse(result.text);
// Strict - evaluates actual relevance to query
```

### 3. Strict Evaluation Criteria

The LLM prompt includes explicit rules:

1. **IGNORE search relevance scores** - Evaluate based ONLY on content
2. **Be STRICT** - Verse must actually relate to query, not just contain similar words
3. **Evaluate importance levels:**
   - **HIGH**: Directly answers the question
   - **MEDIUM**: Provides relevant supporting information
   - **LOW**: Only tangentially related
   - **FILTERED**: Completely irrelevant

4. **Example evaluation:**
   - Query: "What is the Nasadiya Sukta about?"
   - HIGH: Discusses creation, cosmic origins, or mentions Nasadiya/10.129
   - MEDIUM: Mentions related creation concepts
   - LOW/FILTERED: Just mentions "sukta" without creation context

### 4. Updated Orchestrator

The orchestrator now passes the search query to the analyzer:

```typescript
const analyzerOutput = await this.callAnalyzer({
  userQuery,
  searchQuery: searcherOutput.searchTerm,  // Pass actual search term
  searchResults: searcherOutput.searchResults,
  iterationCount: currentIteration,
  previousSearchTerms
});
```

### 5. Enhanced Quality Requirements

The analyzer now requires:
- **At least 2 high-quality verses** (HIGH or MEDIUM importance) before stopping
- Validates LLM's `needsMoreSearch` decision against actual verse quality
- Falls back to strict filtering if LLM evaluation fails

## LLM Prompt Structure

The analyzer uses a comprehensive prompt that includes:

```typescript
const analysisPrompt = `
${ANALYZER_SYSTEM_PROMPT}

USER QUERY: "${userQuery}"
SEARCH QUERY USED: "${searchQuery}"
PREVIOUS SEARCH TERMS TRIED: [...]
CURRENT ITERATION: X of 5

VERSES TO EVALUATE:
[Verse details without relevance scores]

CRITICAL EVALUATION RULES:
1. IGNORE any search relevance scores
2. Be STRICT - verse must actually relate to query
3. Evaluate each verse's importance level
4. Provide reasoning for each decision

OUTPUT FORMAT (JSON ONLY):
{
  "verseEvaluations": [...],
  "needsMoreSearch": boolean,
  "searchRequest": "sanskrit term",
  "reasoning": "overall assessment"
}
`;
```

## Error Handling

If LLM evaluation fails:
- Falls back to **strict default** - marks all verses as FILTERED
- Requires more search to try again
- Logs error for debugging

## Expected Behavior

### Before (Too Lenient)
- Query: "What is the Nasadiya Sukta about?"
- Results: Approves all 5 verses even if only 1 mentions creation
- Issue: Includes irrelevant verses

### After (Strict)
- Query: "What is the Nasadiya Sukta about?"
- Results: Only approves verses that actually discuss creation/cosmic origins
- Issue: May require more iterations to find enough relevant verses (this is correct behavior!)

## Benefits

1. ✅ **More accurate results** - Only verses that actually relate to the query
2. ✅ **Better search suggestions** - LLM can suggest better search terms when results are insufficient
3. ✅ **Contextual awareness** - Analyzer knows what search was used, providing better context
4. ✅ **Explicit score ignoring** - Clear documentation that relevance scores are not used

## Trade-offs

- ⚠️ **May require more iterations** - Strict evaluation means fewer verses pass
- ⚠️ **More LLM calls** - Each analysis iteration uses the LLM (but more accurate)
- ⚠️ **Slightly slower** - LLM evaluation takes time (but ensures quality)

## Files Modified

1. ✅ `app/lib/agents/analyzer.ts`
   - Updated method signature to accept `searchQuery`
   - Replaced string matching with LLM-based evaluation
   - Added strict evaluation criteria
   - Enhanced quality requirements

2. ✅ `app/lib/agents/ai-sdk-orchestrator.ts`
   - Updated `AnalyzerInput` interface to include `searchQuery`
   - Updated `callAnalyzer()` to pass search query
   - Updated logging to show search query

## Testing Recommendations

1. **Test with specific queries:**
   - "What is the Nasadiya Sukta about?" → Should only accept creation-related verses
   - "Tell me about Agni" → Should accept verses about fire/Agni deity
   - "What are hymns?" → Should be stricter about what constitutes a hymn discussion

2. **Verify filtering:**
   - Check logs to see which verses are FILTERED
   - Verify reasoning provided by LLM
   - Confirm high-quality verses are prioritized

3. **Check search suggestions:**
   - When insufficient verses found, verify LLM suggests appropriate Sanskrit terms
   - Confirm suggestions are different from previous search terms

