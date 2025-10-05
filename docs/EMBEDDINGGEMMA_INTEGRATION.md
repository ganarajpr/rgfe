# EmbeddingGemma Integration

## Overview

This document describes the implementation of in-browser semantic search using Google's **EmbeddingGemma** model with Transformers.js. This implementation provides fully client-side semantic search capabilities without requiring any server-side embedding API.

## Architecture

### Components

1. **Embedding Service** (`app/lib/embedding-service.ts`)
   - Uses Transformers.js to run EmbeddingGemma in the browser
   - Generates query embeddings with proper prefixes
   - Supports Matryoshka Representation Learning (MRL) for dimension truncation

2. **Search Engine** (`app/lib/search-engine.ts`)
   - Loads pre-computed embeddings from binary file
   - Uses Orama for vector search
   - Supports both semantic (vector) and full-text search

3. **Search Tool** (`app/lib/tools/search-tool.ts`)
   - Orchestrates embedding generation and search
   - Provides unified interface for the searcher agent
   - Handles fallback to text search if embeddings fail

### Data Flow

```
User Query
    ↓
Embedding Service (EmbeddingGemma + Transformers.js)
    ↓
Query Embedding (512d)
    ↓
Search Engine (Orama Vector Search)
    ↓
Pre-computed Document Embeddings (loaded from binary)
    ↓
Search Results
```

## Model Details

### EmbeddingGemma

- **Model ID**: `onnx-community/embeddinggemma-300m-ONNX`
- **Parameters**: 308 million
- **Full Dimension**: 768
- **Used Dimension**: 512 (truncated using MRL)
- **Quantization**: q4 (for efficiency)
- **Languages**: 100+ languages supported
- **Performance**: State-of-the-art for its size on MTEB benchmark

### Key Features

1. **Matryoshka Representation Learning (MRL)**
   - Allows truncating embeddings from 768d to 512d, 256d, or 128d
   - Minimal loss in semantic quality
   - Reduces computation and storage requirements

2. **Query Prefix**
   - Queries use special prefix: `"task: search result | query: "`
   - Documents in the index used prefix: `"title: none | text: "`
   - These prefixes optimize retrieval performance

3. **In-Browser Execution**
   - No server required for embedding generation
   - Privacy-preserving (data never leaves browser)
   - Zero embedding API costs
   - Low latency after initial model load

## Implementation Details

### Embedding Generation

```typescript
// Query gets special prefix for retrieval optimization
const prefixedQuery = "task: search result | query: " + userQuery;

// Tokenize
const inputs = await tokenizer(prefixedQuery, {
  padding: true,
  truncation: true,
});

// Generate embedding
const { sentence_embedding } = await model(inputs);

// Truncate to 512 dimensions using MRL
const embedding = fullEmbedding.slice(0, 512);
```

### Binary Index Format

The pre-computed embeddings are stored in a binary format:
- File: `public/smrithi-rgveda-embgemma-512d.bin`
- Format: Custom binary format (see `app/lib/binary-persistence.ts`)
- Documents: All Rigveda verses with 512d embeddings
- Size: ~20MB

### Model Loading

The EmbeddingGemma model is loaded from HuggingFace Hub on first use:
1. Downloads tokenizer (~100KB)
2. Downloads model weights (~200MB with q4 quantization)
3. Caches in browser storage for subsequent use
4. Total initial load time: ~30-60 seconds (depending on connection)

## Configuration

### Default Configuration

Located in `app/lib/embedding-service.ts`:

```typescript
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingServiceConfig = {
  modelId: 'onnx-community/embeddinggemma-300m-ONNX',
  dimension: 512,
  quantization: 'q4',
};
```

### Search Tool Configuration

Located in `app/lib/agents/searcher.ts`:

```typescript
const searchTool = getSearchTool({
  binaryFilePath: '/smrithi-rgveda-embgemma-512d.bin',
  defaultLimit: 10,
  minScore: 0.1,
  useEmbeddings: true,
});
```

## Performance Considerations

### First Load
- **Model Download**: ~30-60 seconds (one-time, cached after)
- **Binary Index Load**: ~1-2 seconds
- **Total Initialization**: ~30-60 seconds

### Subsequent Loads
- **Model Load from Cache**: ~5-10 seconds
- **Binary Index Load**: ~1-2 seconds
- **Total Initialization**: ~5-12 seconds

### Query Performance
- **Embedding Generation**: ~200-500ms per query
- **Vector Search**: ~10-50ms (depending on result limit)
- **Total Query Time**: ~210-550ms

## Migration from WebLLM

### Before (WebLLM)
```typescript
import * as webllm from '@mlc-ai/web-llm';

// WebLLM had limited embedding model support
// Most models were chat models, not embedding models
const engine = await webllm.CreateMLCEngine(modelId);
const embedding = await engine.embeddings.create({ input: text });
```

### After (Transformers.js + EmbeddingGemma)
```typescript
import { AutoTokenizer, AutoModel } from '@huggingface/transformers';

// Dedicated embedding model with proper support
const tokenizer = await AutoTokenizer.from_pretrained(modelId);
const model = await AutoModel.from_pretrained(modelId, { dtype: 'q4' });

const prefixedQuery = "task: search result | query: " + text;
const inputs = await tokenizer(prefixedQuery, { padding: true, truncation: true });
const { sentence_embedding } = await model(inputs);
const embedding = sentence_embedding.tolist()[0].slice(0, 512);
```

## Benefits

1. **Privacy**: All processing happens in the browser
2. **Cost**: No API costs for embedding generation
3. **Latency**: No network round-trip for embeddings (after model load)
4. **Offline**: Works offline after initial model cache
5. **Quality**: State-of-the-art embeddings for multilingual text
6. **Flexibility**: Can adjust dimensions using MRL

## Troubleshooting

### Model Fails to Load
- Check network connection for initial download
- Clear browser cache and try again
- Verify HuggingFace Hub is accessible

### Slow Embedding Generation
- First query is slower (model initialization)
- Subsequent queries should be 200-500ms
- Consider using higher quantization (q8) for better performance

### Search Returns No Results
- Check embedding dimension matches binary index (512d)
- Verify binary file is accessible at `/smrithi-rgveda-embgemma-512d.bin`
- Try lowering minScore threshold in search configuration

### Browser Memory Issues
- EmbeddingGemma with q4 quantization: ~200MB
- Binary index: ~20MB
- WebLLM model (if loaded): ~2-4GB
- Consider using only EmbeddingGemma for embedding-only workflows

## References

- **Blog Post**: [In-browser semantic search with EmbeddingGemma](https://glaforge.dev/posts/2025/09/08/in-browser-semantic-search-with-embeddinggemma/)
- **Model**: [onnx-community/embeddinggemma-300m-ONNX](https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX)
- **Transformers.js**: [HuggingFace Transformers.js](https://huggingface.co/docs/transformers.js)
- **Paper**: [EmbeddingGemma (Google DeepMind)](https://huggingface.co/blog/embeddinggemma)

## Future Enhancements

1. **Local Model Files**: Store model weights locally to avoid initial download
2. **Progressive Loading**: Show UI while model loads in background
3. **Multiple Dimensions**: Support 128d, 256d variants for faster search
4. **Batch Processing**: Process multiple queries in parallel
5. **Model Caching Strategy**: Implement smart cache invalidation
