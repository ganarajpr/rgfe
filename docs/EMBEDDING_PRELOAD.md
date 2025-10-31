# Embedding Model Pre-loading

## Overview
The embedding model is now pre-loaded during application initialization, before the chat interface becomes visible. This ensures the model is ready for semantic search immediately when the user starts chatting.

## Changes Made

### 1. App Initialization (`app/page.tsx`)

**New State Variables:**
- `isEmbeddingLoading` - Tracks if embedding service is currently loading
- `isEmbeddingReady` - Indicates if embedding service is ready to use
- `embeddingProgress` - Loading progress (0-100)
- `embeddingMessage` - Current loading status message
- `embeddingError` - Error message if initialization fails

**New Function: `initializeEmbeddingService()`**
- Initializes the search tool with embedding service
- Reports progress via callback
- Handles errors gracefully
- Called automatically during app startup and model selection

**Loading Flow:**
1. User opens app or selects a model
2. LLM loads (WebLLM or Gemini)
3. Embedding service loads automatically
4. Chat interface becomes visible only when both are ready

**Error Handling:**
- If embedding initialization fails, shows dedicated error screen
- Provides clear error message and troubleshooting steps
- Offers "Retry" button to attempt re-initialization

### 2. Search Tool (`app/lib/tools/search-tool.ts`)

**Critical Change:**
- Removed try-catch block that was catching and suppressing embedding initialization errors
- Errors now propagate immediately up the call stack
- System stops immediately if embedding initialization fails (no fallback to text search)

```typescript
// BEFORE: Error was caught and logged, system continued with text search
try {
  await embeddingService.initialize(progressCallback);
} catch (error) {
  console.warn('⚠️ Failed to initialize embedding service, will use text search:', error);
}

// AFTER: Error propagates up, system stops immediately
const embeddingService = getEmbeddingService(DEFAULT_EMBEDDING_CONFIG);
await embeddingService.initialize(progressCallback);
```

### 3. Searcher Agent (`app/lib/agents/searcher.ts`)

**Removed Lazy Initialization:**
- No longer initializes search tool on first search request
- Assumes search tool is already initialized during app startup
- Removed initialization checks from `processSearchRequest()` and `searchWithContext()`

**Enhanced Error Logging:**
- Clearer error messages when initialization fails
- Explicit "CRITICAL" markers in logs

### 4. Multi-Agent Hook (`app/hooks/useMultiAgent.ts`)

**Improved Error Messages:**
- Detects embedding-related errors
- Shows user-friendly error message with troubleshooting steps
- Distinguishes between embedding errors and other errors

## User Experience

### Before
1. App loads → Chat interface appears immediately
2. User sends first message
3. System attempts to initialize embedding model (30-60 seconds)
4. If initialization fails, falls back to text search silently
5. User gets poor results without knowing why

### After
1. App loads → Shows loading screen
2. LLM loads (if needed)
3. Embedding model loads (shows progress: "Loading tokenizer...", "Loading model weights...")
4. Chat interface appears only when everything is ready
5. If embedding fails, shows clear error screen with retry option
6. User always knows system status

## Benefits

1. **Better UX**: No waiting after first message is sent
2. **Clear Status**: User sees loading progress and knows when system is ready
3. **Error Transparency**: Clear error messages instead of silent fallbacks
4. **Reliability**: System won't start if critical components aren't ready
5. **Consistency**: Same initialization flow for both new sessions and cached sessions

## Loading Stages

The loading screen shows progress through these stages:

1. **Initial Check** (0%)
   - Checking for cached models
   - Loading configuration

2. **LLM Loading** (0-100%)
   - WebLLM: Downloads and loads model weights
   - Gemini: Validates API key

3. **Embedding Service Loading** (0-100%)
   - 0-30%: Loading tokenizer
   - 30-100%: Loading model weights
   - 100%: Model ready

## Error Handling

If embedding initialization fails:

1. **Stop Immediately**: System does not proceed to chat interface
2. **Show Error Screen**: Clear, actionable error message
3. **Troubleshooting Tips**: 
   - Check internet connection
   - Verify model repository exists
   - Check model ID configuration
4. **Retry Option**: User can attempt re-initialization

## Configuration

Embedding model configuration in `app/lib/embedding-service.ts`:

```typescript
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingServiceConfig = {
  modelId: 'bsbarkur/rgveda-embedding-gemma-onnx',
  dimension: 512,
  // dtype: 'fp32' specified in initialization to load model.onnx
};
```

## Performance

- **First Load**: 30-60 seconds (downloads model from Hugging Face)
- **Cached Load**: 5-10 seconds (loads from browser cache)
- **Model Size**: ~200MB (fp32 precision)
- **Storage**: IndexedDB/browser cache

## Future Improvements

1. **Progress Estimation**: More accurate progress reporting
2. **Partial Loading**: Allow chat with simpler models while embedding loads
3. **Background Updates**: Update model in background without blocking UI
4. **Offline Support**: Cache model for offline use
5. **Model Selection**: Allow user to choose embedding model

## Related Files

- `/app/page.tsx` - Main initialization logic
- `/app/lib/tools/search-tool.ts` - Search tool with embedding initialization
- `/app/lib/agents/searcher.ts` - Searcher agent (no longer initializes on first use)
- `/app/hooks/useMultiAgent.ts` - Enhanced error handling
- `/app/lib/embedding-service.ts` - Embedding model configuration
- `/app/components/LoadingScreen.tsx` - Loading screen component

## Testing

To test the embedding pre-loading:

1. **Normal Flow**:
   ```bash
   npm run dev
   # Open browser, select model
   # Watch loading screen show embedding progress
   # Verify chat interface appears only when ready
   ```

2. **Error Simulation**:
   - Change model ID to invalid value in `embedding-service.ts`
   - Reload app
   - Verify error screen appears with clear message

3. **Cached Flow**:
   - Load app once (model downloads)
   - Reload app
   - Verify faster loading from cache

## Date
October 31, 2025

