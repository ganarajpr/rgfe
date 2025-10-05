# Testing Semantic Search

This guide explains how to test the EmbeddingGemma + Orama semantic search integration.

## Test Page

A dedicated test page (`app/test-search/page.tsx`) is available to verify the search system works correctly.

### Running the Test

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open the test page:**
   Navigate to `http://localhost:3000/test-search` in your browser

3. **Initialize the system:**
   - Click the "Initialize System" button
   - Wait for the EmbeddingGemma model to download (~200MB, one-time)
   - Wait for the binary index to load (~20MB)
   - Wait for the Orama database to be created and populated

4. **Run a search:**
   - Enter a query in the search box (e.g., "fire sacrifice ritual", "cosmic order", "hymn to dawn")
   - Click "Search" or press Enter
   - View the results and metrics

### What to Look For

#### ✅ Success Indicators

1. **Initialization**
   - Model loads without errors
   - Binary index loads successfully
   - Documents are inserted into Orama
   - Total time: 30-60 seconds (first load), 5-12 seconds (cached)

2. **Embedding Generation**
   - Query embedding is generated
   - Dimension is 512
   - Time: 200-500ms
   - First 5 values are displayed in console

3. **Search Results**
   - Multiple results are returned
   - Scores are between 0 and 1
   - Higher scored results appear first
   - Results are relevant to the query
   - Source information is displayed

#### ❌ Failure Indicators

1. **Model Load Failures**
   - Network errors (check internet connection)
   - CORS errors (ensure running from localhost)
   - Out of memory errors (close other tabs)

2. **Search Failures**
   - No results found (may need to adjust query)
   - Incorrect dimensions (should be 512)
   - Extremely slow search (>5 seconds)

### Metrics to Monitor

| Metric | Expected Value | What It Means |
|--------|---------------|---------------|
| Initialization Time | 5-60 seconds | Time to load model + index |
| Embedding Time | 200-500ms | Time to generate query embedding |
| Search Time | 10-50ms | Time to perform vector search |
| Total Documents | 10,000+ | Number of searchable documents |

### Example Queries

Try these queries to test different aspects:

1. **Sanskrit Concepts:**
   - "dharma and duty"
   - "cosmic order rita"
   - "sacrifice and ritual"

2. **Deities:**
   - "Indra thunder god"
   - "Agni fire deity"
   - "Soma sacred drink"

3. **Natural Phenomena:**
   - "dawn and morning"
   - "fire and flames"
   - "rain and water"

4. **Abstract Concepts:**
   - "truth and cosmic law"
   - "creation of the universe"
   - "immortality and gods"

### Console Output

The test page provides detailed console output showing:
- Each step of initialization
- Tokenization process
- Model inference
- Embedding details (dimension, values)
- Search parameters
- Results with scores

### Troubleshooting

#### Model Doesn't Load

**Problem:** Model fails to download or times out

**Solutions:**
1. Check internet connection
2. Verify HuggingFace CDN is accessible
3. Clear browser cache and reload
4. Try a different browser

#### Binary Index Fails to Load

**Problem:** Binary file not found or corrupted

**Solutions:**
1. Verify `/smrithi-rgveda-embgemma-512d.bin` exists in `public/`
2. Check file size (~20MB)
3. Ensure the file wasn't corrupted during download
4. Restart dev server

#### Search Returns No Results

**Problem:** Vector search finds no matches

**Solutions:**
1. Check embedding dimension matches (should be 512)
2. Try different queries
3. Verify documents were inserted into Orama
4. Check console for error messages

#### Slow Performance

**Problem:** Search takes too long

**Solutions:**
1. First query is always slower (model warmup)
2. Close other browser tabs to free memory
3. Ensure hardware acceleration is enabled
4. Try on a different device

### Advanced Testing

#### Testing in Production Build

1. Build the static site:
   ```bash
   npm run export
   ```

2. Serve the build:
   ```bash
   npx serve out
   ```

3. Open `http://localhost:3000/test-search`

#### Testing Different Queries

Create a batch of test queries to verify consistency:

```javascript
const testQueries = [
  "fire and sacrifice",
  "cosmic order rita",
  "hymn to dawn",
  "Indra god of thunder",
  "creation of the universe"
];

for (const query of testQueries) {
  // Run search and record results
  // Compare relevance scores
  // Verify results are semantically similar
}
```

#### Memory Profiling

Use browser DevTools to monitor memory:

1. Open DevTools → Performance tab
2. Start recording
3. Initialize system
4. Run several searches
5. Check memory usage and GC behavior

Expected memory usage:
- EmbeddingGemma model: ~200MB
- Binary index: ~20MB
- Orama database: ~50-100MB
- Total: ~270-320MB

### Integration Testing

To test the full integration in the main app:

1. Run the development server:
   ```bash
   npm run dev
   ```

2. Open the main app: `http://localhost:3000`

3. Select a model and wait for it to load

4. Ask a Sanskrit-related question:
   - "What is dharma in the Rigveda?"
   - "Tell me about Agni"
   - "Explain the concept of rita"

5. Observe the agent workflow:
   - Orchestrator classifies the query
   - Searcher agent performs semantic search
   - Generator agent creates response

6. Check browser console for detailed logs

### Benchmarking

Record performance metrics across multiple runs:

| Run | Init Time | Embed Time | Search Time | Results Found |
|-----|-----------|------------|-------------|---------------|
| 1   | 45s       | 320ms      | 25ms        | 10            |
| 2   | 8s        | 280ms      | 18ms        | 10            |
| 3   | 7s        | 295ms      | 22ms        | 10            |

Average the results to get baseline performance.

## Automated Testing

For automated testing, consider using:

1. **Playwright** for browser automation
2. **Jest** for unit tests
3. **Cypress** for E2E tests

Example Playwright test:

```javascript
test('semantic search works', async ({ page }) => {
  await page.goto('http://localhost:3000/test-search');
  
  // Initialize
  await page.click('#initBtn');
  await page.waitForSelector('.status.success', { timeout: 120000 });
  
  // Search
  await page.fill('#queryInput', 'fire sacrifice');
  await page.click('#searchBtn');
  await page.waitForSelector('.result', { timeout: 10000 });
  
  // Verify results
  const results = await page.$$('.result');
  expect(results.length).toBeGreaterThan(0);
});
```

## Continuous Integration

Add search testing to CI/CD pipeline:

```yaml
- name: Test Search
  run: |
    npm run build
    npx serve out &
    sleep 5
    npx playwright test tests/search.spec.js
```

## Reporting Issues

When reporting search issues, include:

1. Browser and version
2. Operating system
3. Query that failed
4. Console output (errors and warnings)
5. Network tab (for download issues)
6. Performance metrics
7. Steps to reproduce

## Success Criteria

The search system is working correctly when:

- ✅ Model loads without errors
- ✅ Binary index loads completely
- ✅ Documents are inserted into Orama
- ✅ Query embeddings are generated (512d)
- ✅ Search returns relevant results
- ✅ Performance is within expected ranges
- ✅ Memory usage is reasonable
- ✅ Multiple queries work consistently
- ✅ Results are semantically relevant to queries
