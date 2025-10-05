# Search Functionality Documentation

## Overview

The search functionality provides semantic search capabilities over the Sanskrit text corpus (Rigveda and other texts) using Orama's full-text and vector search engine. The search index is pre-built, compressed, and loaded directly in the browser for fast, client-side searching.

## Architecture

### Components

1. **Binary Persistence (`app/lib/binary-persistence.ts`)**
   - Browser-compatible utility for loading compressed binary search indexes
   - Converts binary format to JavaScript objects with embeddings
   - Uses `pako` for gzip decompression
   - Handles the custom binary format created in the sembed project

2. **Search Engine (`app/lib/search-engine.ts`)**
   - Singleton search engine using Orama
   - Loads and indexes documents with embeddings
   - Supports both text-based and vector-based search
   - Lazy initialization pattern for better performance

3. **Search Tool (`app/lib/tools/search-tool.ts`)**
   - High-level API for the searcher agent
   - Converts search results to agent-friendly format
   - Provides search statistics and status

4. **Searcher Agent (`app/lib/agents/searcher.ts`)**
   - Multi-agent system component
   - Uses the search tool to find relevant passages
   - Supports refined search with deduplication

### Data Flow

```
Binary File (.bin) 
    ↓
Binary Persistence (decompress & parse)
    ↓
Document Objects with Embeddings
    ↓
Orama Search Engine (index creation)
    ↓
Search Tool API
    ↓
Searcher Agent
    ↓
User Interface
```

## Binary Index Format

The search index is stored in a compressed binary format:

- **Compression**: gzip (using pako in browser)
- **Structure**: 
  - Header (metadata: version, timestamp, document count)
  - Documents (id, text, book, bookContext, embedding)
- **Embeddings**: 512-dimensional float32 vectors
- **Size**: ~20MB compressed

### Binary File Location

The binary index file is located at:
```
/public/smrthi-rgveda-qw8b-512d.bin
```

This file is served statically and fetched by the browser when the search engine initializes.

## Usage

### Initializing the Search Engine

The search engine is automatically initialized when the searcher agent is first used. However, you can manually initialize it for better control:

```typescript
import { getSearchTool } from '@/app/lib/tools/search-tool';

// Initialize the search tool
const searchTool = getSearchTool({
  binaryFilePath: '/smrthi-rgveda-qw8b-512d.bin',
  defaultLimit: 10,
  minScore: 0.1,
});

await searchTool.initialize();
```

### Performing a Search

#### Text-based Search

```typescript
import { getSearchTool } from '@/app/lib/tools/search-tool';

const searchTool = getSearchTool();

// Perform a text search
const results = await searchTool.search('dharma karma', 10);

console.log(`Found ${results.length} results`);
results.forEach(result => {
  console.log(`${result.title}: ${result.content}`);
  console.log(`Relevance: ${result.relevance}`);
});
```

#### Vector Search (with query embedding)

```typescript
import { getSearchTool } from '@/app/lib/tools/search-tool';

const searchTool = getSearchTool();

// Generate query embedding (using your embedding model)
const queryEmbedding = await generateEmbedding('What is dharma?');

// Perform a vector search
const results = await searchTool.vectorSearch(queryEmbedding, 10);
```

### Using the Searcher Agent

The searcher agent automatically uses the search tool:

```typescript
import { SearcherAgent } from '@/app/lib/agents/searcher';

const searcher = new SearcherAgent(model);

// Initialize the search tool (optional, done automatically on first search)
await searcher.initializeSearchTool();

// Perform a search
const response = await searcher.search(context);

console.log(response.searchResults);
```

## Search Result Format

Search results follow the `SearchResult` interface:

```typescript
interface SearchResult {
  id: string;           // Unique document ID
  title: string;        // Book name and context
  content: string;      // The actual text passage
  relevance: number;    // Relevance score (0-1)
  source?: string;      // Book name
}
```

## Performance Considerations

### Initialization Time

- **First Load**: ~2-5 seconds (download + decompress + index)
- **Subsequent Loads**: Instant (already initialized)
- **Memory Usage**: ~50-100MB (documents + embeddings + index)

### Search Performance

- **Text Search**: ~10-50ms per query
- **Vector Search**: ~50-200ms per query (depending on corpus size)
- **Concurrent Searches**: Supported (single index, multiple queries)

### Optimization Tips

1. **Initialize Early**: Call `searchTool.initialize()` during app startup
2. **Cache Results**: Store frequent search results in memory
3. **Limit Results**: Use appropriate `limit` parameter to reduce processing
4. **Use Thresholds**: Set `minScore` to filter low-quality results

## Search Modes

### 1. Full-Text Search (Current Default)

- Uses Orama's built-in full-text search
- Tokenization, stemming, and fuzzy matching
- Fast and accurate for keyword-based queries
- No additional embedding generation required

### 2. Vector Search (Available but requires query embeddings)

- Uses cosine similarity on embeddings
- Better for semantic/conceptual queries
- Requires generating embeddings for query text
- More computationally intensive

### 3. Hybrid Search (Future Enhancement)

- Combines full-text and vector search
- Best of both worlds: keyword precision + semantic understanding
- Weighted combination of scores

## Future Enhancements

### 1. Client-Side Embedding Generation

Add a lightweight embedding model (e.g., using Transformers.js) to generate query embeddings in the browser:

```typescript
import { pipeline } from '@xenova/transformers';

// Initialize embedding model
const embedder = await pipeline('feature-extraction', 'sentence-transformers/all-MiniLM-L6-v2');

// Generate query embedding
const queryEmbedding = await embedder(queryText, { 
  pooling: 'mean', 
  normalize: true 
});
```

### 2. Hybrid Search

Implement hybrid search combining text and vector approaches:

```typescript
async hybridSearch(query: string, limit: number = 10) {
  const textResults = await this.textSearch(query, limit * 2);
  const vectorResults = await this.vectorSearch(queryEmbedding, limit * 2);
  
  // Combine and re-rank results
  return this.combineResults(textResults, vectorResults, limit);
}
```

### 3. Search Filters

Add filtering capabilities:

```typescript
// Filter by book
const results = await searchTool.search('dharma', 10, {
  book: 'Rigveda'
});

// Filter by date range or context
const results = await searchTool.search('fire', 10, {
  bookContext: 'Mandala 1'
});
```

### 4. Search History and Personalization

- Store user search history
- Learn from user interactions
- Personalize result ranking

### 5. Incremental Updates

- Support adding new documents without rebuilding entire index
- Delta updates from server
- Versioned indexes

## Troubleshooting

### Issue: Search engine fails to initialize

**Symptoms**: Error message about binary file not found

**Solution**: 
- Verify the binary file exists at `/public/smrthi-rgveda-qw8b-512d.bin`
- Check browser console for network errors
- Ensure the file is being served correctly by Next.js

### Issue: Slow search performance

**Symptoms**: Searches take more than 1 second

**Solution**:
- Reduce the `limit` parameter
- Check browser memory usage
- Ensure initialization completed successfully
- Use text search instead of vector search

### Issue: No results found

**Symptoms**: Empty result array for valid queries

**Solution**:
- Check query spelling and language
- Lower the `minScore` threshold
- Try broader search terms
- Verify the index was loaded correctly

### Issue: Memory issues

**Symptoms**: Browser crashes or becomes unresponsive

**Solution**:
- Reduce the corpus size
- Use pagination for large result sets
- Clear search engine cache periodically

## Dependencies

- `@orama/orama`: ^2.x - Search engine
- `pako`: ^2.x - Gzip compression/decompression
- `@types/pako`: ^2.x - TypeScript types

## Related Files

- `/app/lib/binary-persistence.ts` - Binary format loader
- `/app/lib/search-engine.ts` - Core search engine
- `/app/lib/tools/search-tool.ts` - Search tool API
- `/app/lib/agents/searcher.ts` - Searcher agent
- `/app/lib/agents/types.ts` - Type definitions
- `/public/smrthi-rgveda-qw8b-512d.bin` - Binary search index

## Testing

To test the search functionality:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open the browser console

3. The search engine will initialize when the searcher agent is first used

4. Look for console logs:
   - `🔧 Initializing search engine...`
   - `Loading Orama data from binary format...`
   - `✅ Binary data loaded successfully: X documents`
   - `✅ Search engine initialized successfully`

5. Perform a search through the chat interface and check for:
   - `🔍 Searching for: "your query"`
   - `✅ Found X results`

## Contributing

When modifying the search functionality:

1. Update the binary format version if changing structure
2. Update this documentation
3. Add appropriate error handling
4. Test with various query types
5. Monitor performance impact
6. Update type definitions if needed

## References

- [Orama Documentation](https://docs.oramasearch.com/)
- [Orama Vector Search](https://docs.oramasearch.com/docs/orama-js/search/vector-search)
- [Pako Library](https://github.com/nodeca/pako)

