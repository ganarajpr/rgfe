# Quick Start Guide

Get your AI chat interface up and running in minutes!

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18 or higher** - [Download here](https://nodejs.org/)
- **A WebGPU-compatible browser**:
  - Chrome 113+ (Recommended)
  - Edge 113+
  - Opera 99+
- **At least 8GB RAM** for larger models
- **~5GB free disk space** for model caching

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install all necessary packages including:
- Next.js 15
- WebLLM
- Tailwind CSS
- TypeScript support

### 2. Start Development Server

```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000)

### 3. Open in Browser

Navigate to `http://localhost:3000` in your browser.

## First-Time Usage

### Step 1: Select a Model

On your first visit, you'll see the model selection screen:

1. Choose from available models:
   - **Qwen3 8B** (4.8GB) - **Recommended** - Best multilingual capability and reasoning
   - **Gemma 3 4B Instruct** (2.4GB) - Google's efficient model with strong performance
   - **Mistral 7B Instruct v0.3** (4.2GB) - High-quality reasoning and instruction following
   - **Qwen3 4B** (2.4GB) - Balanced performance with good multilingual support
   - **Qwen3 0.6B** (0.4GB) - Ultra-lightweight model for fast responses

2. Click "Load Model"

### Step 2: Wait for Download

- The model will download and cache in your browser
- **First time only**: This takes 1-5 minutes depending on model size and internet speed
- You'll see a progress bar with percentage
- **Subsequent loads**: Almost instant (model is cached)

### Step 3: Start Chatting!

Once loaded:

1. The chat interface appears automatically
2. Type your message in the input box
3. Press **Enter** to send (or click the send button)
4. Use **Shift + Enter** for new lines

## Common Commands

```bash
# Development
npm run dev          # Start dev server with hot reload

# Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## Tips for Best Experience

### Performance Tips

1. **Start Small**: Use Llama 3.2 3B or Phi 3.5 Mini for your first try
2. **Close Tabs**: Free up RAM by closing unnecessary browser tabs
3. **Be Patient**: First response may be slower as the model warms up

### Model Selection Guide

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| Qwen3 8B | 4.8GB | Medium | Excellent | **Recommended** - Multilingual, complex reasoning |
| Gemma 3 4B Instruct | 2.4GB | Fast | Good | Google's efficient model, general tasks |
| Mistral 7B Instruct v0.3 | 4.2GB | Medium | Excellent | High-quality reasoning, instruction following |
| Qwen3 4B | 2.4GB | Fast | Good | Balanced performance, multilingual support |
| Qwen3 0.6B | 0.4GB | Very Fast | Good | Ultra-lightweight, speed-critical tasks |

### Keyboard Shortcuts

- `Enter` - Send message
- `Shift + Enter` - New line in input
- Click "New Chat" button - Start fresh conversation

## Troubleshooting Quick Fixes

### Problem: Model won't load

**Solution**:
```
1. Check browser console (F12) for errors
2. Verify WebGPU support: Visit chrome://gpu
3. Try a different browser
4. Clear browser cache and reload
```

### Problem: "Out of memory" error

**Solution**:
```
1. Close other browser tabs
2. Choose a smaller model (3B or Mini)
3. Restart browser
4. Check system RAM usage
```

### Problem: Very slow responses

**Solution**:
```
1. Normal on first message (model warming up)
2. Check CPU/GPU usage in task manager
3. Try a smaller model
4. Ensure hardware acceleration is enabled in browser
```

### Problem: Model downloads but doesn't work

**Solution**:
```
1. Clear browser IndexedDB storage
2. Try incognito/private mode
3. Check available disk space
4. Reload the page
```

## Verifying WebGPU Support

1. Open Chrome
2. Navigate to `chrome://gpu`
3. Search for "WebGPU"
4. Should show "Hardware accelerated"

If not available:
- Update your browser to the latest version
- Update graphics drivers
- Check your GPU is supported

## What's Next?

Now that you're up and running:

1. **Explore Features**: Try the suggestion prompts on the home screen
2. **Test Different Models**: Each has unique strengths
3. **Read the Docs**: Check `docs/ARCHITECTURE.md` for technical details
4. **Customize**: Modify components to fit your needs

## Need Help?

- Check the main [README.md](../README.md) for detailed documentation
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
- Open an issue on GitHub if you encounter problems

## Privacy Note

🔒 **Everything runs in your browser**
- No data sent to external servers
- No API keys needed
- No telemetry or tracking
- Models cached locally in IndexedDB

Your conversations are completely private!

---

Happy chatting! 🚀

