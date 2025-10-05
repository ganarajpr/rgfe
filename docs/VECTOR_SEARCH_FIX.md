# Vector Search Fix for Searcher Agent

## Issue
The searcher agent was not properly using vector/embedding-based search despite having all the infrastructure in place. The CLI search tool (`cli-search.js`) was working correctly, but the web application's searcher agent was not producing the same quality results.

## Root Cause
The main issue was in `/app/lib/agents/searcher.ts`:

1. **Unnecessary Translation**: The searcher agent was translating English queries to Sanskrit **before** performing semantic vector search
2. **Semantic Search Bypass**: Translation defeated the purpose of embedding-based semantic search
3. **Search Quality Loss**: The embedding model is designed to understand semantic meaning across languages, but translation introduced potential errors

### Why This Was Wrong

```typescript
// ❌ OLD (INCORRECT) - Translation before semantic search
const sanskritQuery = await this.translateToSanskrit(queryToSearch);
const searchResults = await searchTool.search(sanskritQuery, 10);
```

The embedding model (EmbeddingGemma) is trained to understand semantic meaning in multiple languages. When you:
1. Start with English query: "fire sacrifice ritual"
2. Translate to Sanskrit (potentially introducing errors)
3. Generate embeddings from the translated Sanskrit
4. Search the corpus

You lose the semantic richness of the original query and potentially introduce translation errors.

### How It Works Now

```typescript
// ✅ NEW (CORRECT) - Direct semantic search
const searchResults = await searchTool.search(queryToSearch, 10);
// Translation only used as fallback if no results found
```

Now the flow is:
1. Start with English query: "fire sacrifice ritual"
2. Generate embeddings directly from English query
3. Search using semantic similarity (works across languages)
4. Only fall back to translation if semantic search finds nothing

## Changes Made

### 1. Searcher Agent (`app/lib/agents/searcher.ts`)

#### `search()` method:
- **Before**: Always translated query to Sanskrit first
- **After**: Uses original query for semantic vector search
- **Fallback**: Only translates if semantic search returns zero results

#### `refineSearch()` method:
- **Before**: Checked for Devanagari and translated if needed
- **After**: Uses refined query directly for semantic search
- **Fallback**: Only translates if semantic search returns zero results

### 2. Search Engine (`app/lib/search-engine.ts`)

#### `vectorSearch()` method improvements:
- Added `similarity` parameter to match CLI implementation
- Added query embedding norm calculation for debugging
- Improved logging to show embedding characteristics
- Simplified result mapping (no double filtering needed)

## Benefits

1. **Better Search Quality**: Semantic search works as designed, understanding meaning across languages
2. **Faster Searches**: No translation step for most queries
3. **More Reliable**: Translation only used as fallback, reducing potential errors
4. **Consistent with CLI**: Web app now uses same approach as working CLI tool

## Testing

To verify the fix works:

1. Start the application
2. Ask a question in English (e.g., "What is the role of Agni in fire sacrifices?")
3. Check browser console logs - should see:
   ```
   🔍 Performing semantic vector search for: "What is the role of Agni in fire sacrifices?"
   ✅ Found X results with semantic vector search
   ```
4. Translation should only happen if semantic search finds nothing

## How Vector Search Works

1. **Embedding Generation**: 
   - User query → EmbeddingGemma model → 512-dimensional vector
   - Each dimension captures semantic features of the query
   
2. **Vector Similarity**:
   - Compare query embedding with all document embeddings in the index
   - Use cosine similarity to find semantically similar passages
   - Return top-k results with highest similarity scores

3. **Cross-Language Understanding**:
   - Embeddings capture semantic meaning, not just keywords
   - "fire sacrifice ritual" (English) will match similar concepts in Sanskrit texts
   - No translation needed because semantic space is shared

## Configuration

The searcher agent is configured in `app/lib/agents/searcher.ts`:

```typescript
const searchTool = getSearchTool({
  binaryFilePath: '/smrithi-rgveda-embgemma-512d.bin',
  defaultLimit: 10,
  minScore: 0.1,              // Minimum similarity threshold (0.0-1.0)
  useEmbeddings: true,        // Enable semantic vector search
});
```

## Related Files

- `/app/lib/agents/searcher.ts` - Searcher agent implementation
- `/app/lib/search-engine.ts` - Orama vector search engine
- `/app/lib/embedding-service.ts` - EmbeddingGemma embedding generation
- `/app/lib/tools/search-tool.ts` - Search tool wrapper
- `/cli-search.js` - CLI reference implementation (working correctly)

## Notes

- The minimum similarity score is set to `0.1` by default
- Lower scores mean more results but potentially less relevant
- Higher scores mean fewer but more relevant results
- Adjust `minScore` in search tool config if needed

## Future Improvements

1. Add caching for query embeddings to speed up repeated searches
2. Implement hybrid search (combine vector + text search scores)
3. Add query expansion for better recall
4. Tune similarity threshold based on user feedback
