# CLI Search Tool

A simple command-line interface for testing the semantic search functionality without the complexity of the web interface.

## Usage

### Method 1: Using npm script (recommended)
```bash
npm run search "your search query"
```

### Method 2: Direct node execution
```bash
node cli-search.js "your search query"
```

## Examples

```bash
# Search for fire rituals
npm run search "fire sacrifice ritual"

# Search for specific deities
npm run search "Indra thunder god"

# Search for philosophical concepts
npm run search "dharma righteousness"

# Search for natural phenomena
npm run search "dawn sunrise morning"
```

## Features

- **Simple Interface**: No web browser required
- **Fast Initialization**: Loads the embedding model and search index once
- **Detailed Output**: Shows embedding generation time, search time, and results
- **Error Handling**: Clear error messages and graceful failure handling
- **Performance Metrics**: Displays timing information for debugging

## Output Format

The CLI tool provides:
1. **Initialization Progress**: Shows loading progress for the embedding model and search index
2. **Search Metrics**: Embedding generation time and search execution time
3. **Results**: Top 10 most relevant results with:
   - Relevance score
   - Source book and context
   - Full text content

## Requirements

- Node.js (v18 or higher)
- All project dependencies installed (`npm install`)
- Binary search index file at `public/smrithi-rgveda-embgemma-512d.bin`

## Troubleshooting

### "Binary index not found"
Make sure the file `public/smrithi-rgveda-embgemma-512d.bin` exists in your project.

### "Failed to load modules"
Run `npm install` to ensure all dependencies are installed.

### "Model initialization failed"
Check your internet connection as the embedding model is downloaded from HuggingFace on first run.

## Performance

- **First Run**: ~10-30 seconds (downloads model)
- **Subsequent Runs**: ~2-5 seconds (model cached)
- **Search Time**: ~100-500ms per query
- **Memory Usage**: ~200-400MB (model + index)
