# Gemini Integration Guide

## Overview

The application now supports two AI provider options:

1. **Google Gemini** (Recommended) - Cloud-based, fast, and accurate
2. **Mistral via WebLLM** - Local browser-based, private, no API key required

## Features

### Gemini Provider
- Uses Google's Gemini 2.0 Flash Experimental model
- Requires an API key from [Google AI Studio](https://aistudio.google.com/apikey)
- API key is stored in browser's localStorage for convenience
- Fast response times with cloud-based processing
- No model downloads required

### WebLLM Provider
- Runs Mistral models locally in your browser
- Complete privacy - no data sent to external servers
- No API key required
- Model is downloaded and cached in browser (~4-5GB)
- Currently filters and shows only Mistral models

## Implementation Details

### New Files Created

1. **`app/lib/gemini-provider.ts`**
   - Creates a Gemini provider compatible with AI SDK
   - Exports `createGeminiProvider()` function
   - Includes API key validation helper

### Modified Files

1. **`app/components/LLMSelector.tsx`**
   - Complete redesign with two main provider options
   - Radio button interface for provider selection
   - Gemini API key input with localStorage persistence
   - Mistral model selection from available WebLLM models
   - Exports `ModelSelection` interface and `ProviderType` type

2. **`app/page.tsx`**
   - Handles both provider types
   - Creates appropriate model provider based on selection
   - Manages provider state and localStorage persistence
   - Supports switching between providers via cache clear

3. **`package.json`**
   - Added `@ai-sdk/google` dependency for Gemini integration

## Usage

### For Users

1. **Using Gemini (Recommended)**
   - Select "Google Gemini" option
   - Paste your API key from Google AI Studio
   - Click "Connect to Gemini"
   - API key is saved for future sessions

2. **Using Mistral (No API Key)**
   - Select "Mistral (WebLLM)" option
   - Choose a Mistral model from the list
   - Click "Load Model"
   - Model will be downloaded and cached in browser

### Provider Switching

To switch providers:
1. Click "Clear Cache" in the chat interface
2. Select the new provider from the selector
3. Configure and connect

## Technical Architecture

### Provider Selection Flow

```
User selects provider → ModelSelection object created → 
page.tsx handles selection → Creates appropriate provider →
Passes to multi-agent system → Ready for chat
```

### Model Provider Creation

- **Gemini**: `createGeminiProvider(apiKey)` returns LanguageModelV2
- **WebLLM**: `createWebLLMProvider(engine, modelId)` returns LanguageModelV2

Both providers implement the same `LanguageModelV2` interface from AI SDK, making them interchangeable.

### State Management

- Provider type stored in `localStorage` as `provider_type`
- Gemini API key stored in `localStorage` as `gemini_api_key`
- WebLLM uses existing model caching mechanism
- State restored on page reload for seamless experience

## Security Considerations

1. **API Key Storage**
   - Stored in browser's localStorage
   - Never sent to any server except Google's API
   - User can clear by clearing browser data or clicking "Clear Cache"

2. **WebLLM Privacy**
   - All processing happens in browser
   - No data sent to external servers
   - Models cached locally

## Future Enhancements

Potential improvements:
1. Support for more Gemini models (Pro, etc.)
2. API key encryption in localStorage
3. Support for other WebLLM model families (Qwen, etc.)
4. Provider performance metrics
5. Token usage tracking for Gemini

## Troubleshooting

### Gemini Issues

**Problem**: "Invalid API key" error
- **Solution**: Ensure API key is copied correctly from Google AI Studio
- **Solution**: Check if API key has necessary permissions

**Problem**: Rate limit errors
- **Solution**: Wait a few minutes before retrying
- **Solution**: Consider upgrading your Google Cloud quota

### WebLLM Issues

**Problem**: Model download fails
- **Solution**: Check internet connection
- **Solution**: Clear browser cache and retry
- **Solution**: Ensure sufficient disk space (~5GB)

**Problem**: Model not loading
- **Solution**: Ensure browser supports WebGPU
- **Solution**: Check browser console for specific errors

## Testing

The implementation has been tested with:
- Gemini API key validation
- Provider switching
- State persistence across page reloads
- Integration with multi-agent system
- Error handling for both providers

All features are working as expected with minimal linter warnings (cognitive complexity and type assertions).
