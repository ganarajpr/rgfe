# Troubleshooting Guide

## Common Issues and Solutions

### "Failed to load model" Error

**Problem**: When selecting a model, you get an error saying "Failed to load model".

**Cause**: The model ID must exactly match what's available in WebLLM's model registry. Model IDs include the quantization suffix (e.g., `-q4f16_1-MLC`).

**Solution**: ✅ **Already Fixed!** The model IDs in the selector have been updated to use the correct WebLLM format:

Correct model IDs:
- `Qwen3-8B-q4f16_1-MLC`
- `gemma-2-2b-it-q4f16_1-MLC`
- `Mistral-7B-Instruct-v0.3-q4f16_1-MLC`
- `Qwen3-4B-q4f16_1-MLC`
- `Qwen3-0.6B-q4f16_1-MLC`

### Browser Compatibility Issues

**Problem**: Models won't load or you see WebGPU errors.

**Cause**: Your browser doesn't support WebGPU or it's not enabled.

**Solution**:
1. Use Chrome 113+ or Edge 113+ (recommended)
2. Check WebGPU support at `chrome://gpu`
3. Update your graphics drivers
4. Enable hardware acceleration in browser settings

### Out of Memory Errors

**Problem**: Browser crashes or shows "Out of memory" when loading large models.

**Cause**: The selected model is too large for your available RAM.

**Solution**:
1. Close other browser tabs and applications
2. Try a smaller model:
   - **Qwen3 0.6B** (0.4GB) - Smallest
   - **Gemma 2 2B** (1.5GB) - Small and efficient
   - **Qwen3 4B** (2.4GB) - Medium size
3. Restart your browser to clear memory

### Model Download is Very Slow

**Problem**: Model download takes a very long time or appears stuck.

**Cause**: Large models (4-5GB) take time to download, especially on slower connections.

**Solution**:
1. Be patient - first download can take 5-10 minutes on slower connections
2. Don't close the tab or refresh during download
3. The progress bar shows download percentage
4. Model is cached after first download - subsequent loads are instant
5. Try a smaller model if download consistently fails

### Model Fails to Load After Browser Update

**Problem**: Previously working model fails to load after browser update.

**Cause**: Cached WebAssembly binaries may be incompatible with the new browser version.

**Solution**:
1. Clear browser cache for the site
2. In Chrome: Settings → Privacy → Clear browsing data → Cached images and files
3. Or use Incognito mode to test
4. The model will re-download with compatible binaries

### LocalStorage Issues

**Problem**: App keeps asking to select a model even after selection.

**Cause**: LocalStorage might be blocked or cleared.

**Solution**:
1. Check if cookies/storage are allowed for the site
2. Don't use Private/Incognito mode for persistent sessions
3. Clear localStorage and start fresh:
   ```javascript
   // In browser console:
   localStorage.clear();
   ```

### Page Stuck on Loading Screen

**Problem**: Loading screen appears but never progresses.

**Cause**: Model loading failed but error wasn't displayed.

**Solution**: ✅ **Already Fixed!** The app now:
1. Shows detailed error messages
2. Automatically returns to model selector on failure
3. Clears invalid cached model IDs
4. Refreshing the page will show the model selector

### Slow Response Generation

**Problem**: AI takes a very long time to respond.

**Cause**: Normal behavior, especially for larger models or on first message.

**Reasons**:
- First message: Model "warm-up" period
- Larger models: More computation required
- Longer prompts: More tokens to process

**Solutions**:
1. Use a smaller, faster model (Qwen3 0.6B, Gemma 2 2B)
2. Keep messages concise
3. First response is always slowest - subsequent ones are faster
4. Ensure you have a decent GPU for hardware acceleration

### Can't Find a Specific Model

**Problem**: Looking for a model not in the list.

**Solution**: Only models compiled for WebLLM are available. To check all available models:

```javascript
// In browser console after page loads:
const webllm = await import('@mlc-ai/web-llm');
console.log(webllm.prebuiltAppConfig.model_list.map(m => m.model_id));
```

### IndexedDB Quota Exceeded

**Problem**: Error about storage quota being exceeded.

**Cause**: Multiple large models cached in browser storage.

**Solution**:
1. Clear site data in browser settings
2. In Chrome: Settings → Site settings → [your-site] → Clear data
3. Models will need to re-download after clearing

### WebGPU Not Available

**Problem**: Error about WebGPU not being available.

**Cause**: Browser doesn't support WebGPU or it's disabled.

**Check Support**:
```javascript
// In browser console:
if ('gpu' in navigator) {
  console.log('WebGPU is supported!');
} else {
  console.log('WebGPU is NOT supported');
}
```

**Solutions**:
1. Update to Chrome 113+ or Edge 113+
2. Check `chrome://gpu` for GPU status
3. Enable WebGPU at `chrome://flags` (if experimental)
4. Update graphics drivers

## Debugging Tips

### Check Browser Console

Always check the browser console (F12) for detailed error messages:
1. Press F12 to open Developer Tools
2. Go to Console tab
3. Look for red error messages
4. These contain detailed information about what went wrong

### Verify Model Loading

Check if a model is loading correctly:
```javascript
// In browser console during loading:
localStorage.getItem('selectedModel')  // Should show your selected model ID
```

### Clear All Data

To completely reset the app:
```javascript
// In browser console:
localStorage.clear();
// Then: Settings → Clear site data
// Then: Refresh page
```

## Getting Help

If you continue to experience issues:

1. Check browser console for specific error messages
2. Verify WebGPU support at `chrome://gpu`
3. Try a different browser (Chrome or Edge)
4. Try a smaller model first
5. Ensure you have enough RAM and storage
6. Check your internet connection for downloads

## Performance Tips

### For Best Performance:
- ✅ Use Chrome or Edge (latest version)
- ✅ Close unnecessary browser tabs
- ✅ Ensure hardware acceleration is enabled
- ✅ Start with smaller models (0.6B or 2B)
- ✅ Use a computer with dedicated GPU
- ✅ Have at least 8GB RAM
- ✅ Keep first messages short for warm-up

### Expected Performance:
| Model Size | First Load | Subsequent Loads | Response Time |
|------------|-----------|------------------|---------------|
| 0.6B       | 30s-1min  | 2-5s            | 1-3s          |
| 2B         | 1-2min    | 5-10s           | 2-5s          |
| 4B         | 2-3min    | 10-15s          | 3-7s          |
| 8B         | 3-5min    | 15-20s          | 5-15s         |

*Times vary based on hardware and internet speed*

## Known Limitations

1. **Browser Support**: Only Chromium-based browsers (Chrome, Edge, Opera)
2. **Mobile Support**: Limited on mobile due to WebGPU availability
3. **Model Size**: Large models (8B) require significant RAM
4. **Internet Required**: For first-time model download only
5. **Safari**: Currently not supported (no WebGPU)

---

Last Updated: 2025-01-04

