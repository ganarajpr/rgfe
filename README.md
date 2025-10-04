# Frontend AI Chat Interface

A fully client-side AI chat application powered by Next.js, Tailwind CSS, and WebLLM. This application runs entirely in your browser with no backend required - all AI processing happens locally on your device.

## 🌟 Features

- **100% Client-Side**: All AI processing happens in your browser using WebLLM
- **Privacy-First**: No data sent to external servers, everything stays on your device
- **Streaming Responses**: ⚡ Real-time token-by-token generation like ChatGPT
- **Tool Call Detection**: 🔧 Automatic detection of model capabilities
- **Multiple LLM Support**: Choose from various optimized models (Llama, Phi, Qwen)
- **ChatGPT-like Interface**: Professional, modern UI similar to ChatGPT
- **Persistent Model Selection**: Remembers your chosen model across sessions
- **Gmail-Style Loading**: Smooth loading experience while models download
- **Markdown Support**: Rich text formatting in AI responses
- **Dark Mode**: Automatic dark mode based on system preferences
- **Responsive Design**: Works great on desktop, tablet, and mobile

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- A modern browser with WebGPU support (Chrome 113+, Edge 113+)
- At least 8GB RAM for running larger models

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd rgfe
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📖 Usage

### First Time Setup

1. When you first open the application, you'll be prompted to select an AI model
2. Choose a model based on your needs:
   - **Qwen3 8B**: **Recommended** - Best multilingual capability and reasoning (4.8GB)
   - **Gemma 3 4B Instruct**: Google's efficient model with strong performance (2.4GB)
   - **Mistral 7B Instruct v0.3**: High-quality reasoning and instruction following (4.2GB)
   - **Qwen3 4B**: Balanced performance with good multilingual support (2.4GB)
   - **Qwen3 0.6B**: Ultra-lightweight model for fast responses (0.4GB)

3. The model will download and cache in your browser (this happens only once)
4. Once loaded, you can start chatting immediately

### Using the Chat

- Type your message in the input box at the bottom
- Press **Enter** to send (or click the send button)
- Press **Shift + Enter** to add a new line
- Click "New Chat" to start a fresh conversation
- Watch for capability badges in the header:
  - ⚡ **Streaming enabled**: Responses appear in real-time
  - 🔧 **Tool calls supported**: Model can handle function calls

### Model Management

The selected model is automatically cached in your browser's IndexedDB storage. The model choice persists across browser sessions, so you won't need to download it again.

## 🏗️ Project Structure

```
rgfe/
├── app/
│   ├── components/
│   │   ├── ChatInterface.tsx    # Main chat UI component
│   │   ├── ChatMessage.tsx      # Individual message display
│   │   ├── LLMSelector.tsx      # Model selection modal
│   │   └── LoadingScreen.tsx    # Loading screen component
│   ├── hooks/
│   │   └── useWebLLM.ts         # WebLLM integration hook
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main page component
├── public/                      # Static assets
├── package.json
└── README.md
```

## 🛠️ Technologies Used

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **WebLLM**: Browser-based LLM inference powered by MLC
- **Marked**: Markdown parser for rich text rendering

## 🔧 Configuration

### Adding New Models

To add new models to the selection list, edit `app/components/LLMSelector.tsx`:

```typescript
const availableModels = [
  {
    id: 'model-id-from-webllm',
    name: 'Display Name',
    size: 'Download Size',
    description: 'Model description',
  },
  // Add more models here
];
```

Check the [WebLLM model list](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts) for available models.

### Customizing Styles

- Global styles: `app/globals.css`
- Component-specific styles: Inline Tailwind classes in each component
- Color scheme: Automatically adapts to system dark/light mode

## 🌐 Browser Compatibility

This application requires WebGPU support:

- ✅ Chrome 113+
- ✅ Edge 113+
- ✅ Opera 99+
- ⚠️ Firefox (experimental support with flags)
- ❌ Safari (not yet supported)

## 📱 Performance Tips

1. **First Load**: The initial model download may take 1-5 minutes depending on your internet speed
2. **Memory Usage**: Larger models (7B-8B) require more RAM. Close other tabs if experiencing issues
3. **Generation Speed**: Speed depends on your hardware. Newer GPUs provide faster inference
4. **Model Selection**: Start with smaller models (3B-4B) if you have limited resources

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC

## 🙏 Acknowledgments

- [WebLLM](https://github.com/mlc-ai/web-llm) for browser-based LLM inference
- [MLC LLM](https://mlc.ai/) for the underlying ML compilation technology
- [Vercel](https://vercel.com/) for Next.js

## 🐛 Troubleshooting

### Quick Fixes

**Model fails to load:**
- Ensure you're using Chrome 113+ or Edge 113+
- Check WebGPU support at `chrome://gpu`
- Try a smaller model first (Qwen3 0.6B or Gemma 2 2B)

**Out of memory errors:**
- Close other browser tabs
- Try a smaller model
- Ensure you have enough RAM available

**Slow generation:**
- Normal for first-time use as model warms up
- Consider using a smaller model
- Check if hardware acceleration is enabled in browser settings

### Detailed Troubleshooting

For comprehensive troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

## 📚 Documentation

- **[FEATURES.md](./docs/FEATURES.md)**: Complete feature list
- **[MODEL_CAPABILITIES.md](./docs/MODEL_CAPABILITIES.md)**: Streaming & tool call guide
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: Technical deep dive
- **[QUICK_START.md](./docs/QUICK_START.md)**: Getting started guide
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)**: Deployment instructions
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**: Comprehensive troubleshooting

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [WebLLM Documentation](https://webllm.mlc.ai/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

Built with ❤️ using Next.js and WebLLM
