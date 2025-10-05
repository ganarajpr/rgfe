# Frontend AI Chat Interface

A fully client-side AI chat application powered by Next.js, Tailwind CSS, and WebLLM. This application runs entirely in your browser with no backend required - all AI processing happens locally on your device.

## 🌟 Features

- **100% Client-Side**: All AI processing happens in your browser using WebLLM
- **Privacy-First**: No data sent to external servers, everything stays on your device
- **Multi-Agent System**: 🤖 Specialized AI agents work together for comprehensive Sanskrit literature answers
- **Streaming Responses**: ⚡ Real-time token-by-token generation like ChatGPT
- **Intelligent Routing**: Orchestrator agent classifies queries and routes to specialized agents
- **Iterative Refinement**: Agents can request additional searches for better answers
- **Real-Time Status Updates**: See what each agent is doing as they process your query
- **Multiple LLM Support**: Choose from various optimized models (Llama, Phi, Qwen)
- **ChatGPT-like Interface**: Professional, modern UI similar to ChatGPT
- **Persistent Model Selection**: Remembers your chosen model across sessions
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

### 🌐 Live Demo

The application is deployed on GitHub Pages and can be accessed at:
**https://[your-username].github.io/rgfe/**

## 📦 Deployment

### GitHub Pages (Automatic)

This project is configured for automatic deployment to GitHub Pages:

1. **Enable GitHub Pages**: Go to your repository Settings → Pages
2. **Source**: Select "GitHub Actions" as the source
3. **Automatic Deployment**: Every push to `main`/`master` branch will automatically deploy

The deployment workflow will:
- Build the static site using `npm run export`
- Deploy to GitHub Pages
- Make the site available at `https://[username].github.io/rgfe/`

### Manual Deployment

To deploy manually:

```bash
# Build the static site
npm run export

# The built files will be in the 'out' directory
# Upload the contents of 'out' to your web server
```

### Local Static Build

To test the static build locally:

```bash
npm run export
npx serve out
```

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

## 🤖 Multi-Agent System

This application features a sophisticated **multi-agent system** specialized in Sanskrit literature queries. Three specialized AI agents work together to provide comprehensive, well-researched answers:

### Agent Architecture

```
User Query → Orchestrator Agent → Classification
                    ↓
    Sanskrit-related?    Non-Sanskrit → Polite decline
                    ↓
            Searcher Agent → Find relevant texts
                    ↓
            Generator Agent → Analyze & Generate answer
                    ↓
            Need more info? → Refined search → Loop back
                    ↓
            Stream final answer to user
```

### The Agents

1. **🤖 Orchestrator Agent** - Classifies queries and routes to appropriate agents
2. **🔍 Searcher Agent** - Finds relevant information from Sanskrit texts using semantic search
3. **📝 Generator Agent** - Creates comprehensive answers with citations

### Semantic Search with EmbeddingGemma

The search system uses **Google's EmbeddingGemma** (300M parameters) running entirely in the browser:

- **In-Browser Embeddings**: Transformers.js powers local embedding generation
- **Privacy-First**: No data sent to external servers
- **10,000+ Documents**: Sanskrit passages with 512-dimensional embeddings
- **Multilingual**: Supports 100+ languages
- **Fast**: Query embeddings generated in ~200-500ms after model load

For details, see [EMBEDDINGGEMMA_INTEGRATION.md](./docs/EMBEDDINGGEMMA_INTEGRATION.md)

### Real-Time Feedback

Watch the agents work with real-time status updates:
- 🤖 "Analyzing your query..."
- 🔍 "Searching for relevant information..."
- ✅ "Found 5 relevant sources"
- 📝 "Generating comprehensive answer..."
- ✅ "Answer complete"

### Example Queries

Try asking about:
- "Explain the concept of Dharma in the Bhagavad Gita"
- "What are the main schools of Hindu philosophy?"
- "Tell me about the Upanishads"
- "Summarize the story of the Mahabharata"

For more details, see [MULTI_AGENT_SYSTEM.md](./docs/MULTI_AGENT_SYSTEM.md)

## 🏗️ Project Structure

```
rgfe/
├── app/
│   ├── components/
│   │   ├── AgentChatInterface.tsx   # Multi-agent chat UI
│   │   ├── AgentChatMessage.tsx     # Agent message renderer
│   │   ├── ChatInterface.tsx        # Original chat UI
│   │   ├── ChatMessage.tsx          # Individual message display
│   │   ├── LLMSelector.tsx          # Model selection modal
│   │   └── LoadingScreen.tsx        # Loading screen component
│   ├── hooks/
│   │   ├── useWebLLM.ts             # WebLLM integration hook
│   │   └── useMultiAgent.ts         # Multi-agent orchestration
│   ├── lib/
│   │   ├── agents/
│   │   │   ├── types.ts             # Agent type definitions
│   │   │   ├── orchestrator.ts      # Orchestrator agent
│   │   │   ├── searcher.ts          # Searcher agent
│   │   │   └── generator.ts         # Generator agent
│   │   └── webllm-provider.ts       # AI SDK adapter for WebLLM
│   ├── globals.css                  # Global styles
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Main page component
├── docs/
│   ├── MULTI_AGENT_SYSTEM.md        # Multi-agent architecture docs
│   ├── FEATURES.md                  # Complete feature list
│   ├── ARCHITECTURE.md              # Technical deep dive
│   └── ...
├── public/                          # Static assets
├── package.json
└── README.md
```

## 🛠️ Technologies Used

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **WebLLM**: Browser-based LLM inference powered by MLC
- **Vercel AI SDK**: Framework for building multi-agent AI systems
- **Marked**: Markdown parser for rich text rendering
- **Zod**: Schema validation for agent communications

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
- [Transformers.js](https://huggingface.co/docs/transformers.js) by HuggingFace for in-browser ML models
- [EmbeddingGemma](https://huggingface.co/blog/embeddinggemma) by Google DeepMind for semantic embeddings
- [Orama](https://oramasearch.com/) for fast in-memory vector search
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

## 🧪 Testing

### Test Semantic Search

A dedicated test page is available to verify the EmbeddingGemma + Orama integration:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open the test page:**
   Navigate to `http://localhost:3000/test-search`

3. **Click "Initialize System"** to load the embedding model and search index

4. **Enter a test query** (e.g., "fire sacrifice ritual") and click "Search"

The test page provides:
- Real-time initialization progress
- Performance metrics (initialization, embedding, search times)
- Detailed console output
- Visual search results with scores and sources

For detailed testing instructions, see [TESTING_SEARCH.md](./docs/TESTING_SEARCH.md)

## 📚 Documentation

- **[MULTI_AGENT_SYSTEM.md](./docs/MULTI_AGENT_SYSTEM.md)**: Multi-agent architecture & design
- **[EMBEDDINGGEMMA_INTEGRATION.md](./docs/EMBEDDINGGEMMA_INTEGRATION.md)**: In-browser semantic search with EmbeddingGemma
- **[TESTING_SEARCH.md](./docs/TESTING_SEARCH.md)**: Testing semantic search functionality
- **[FEATURES.md](./docs/FEATURES.md)**: Complete feature list
- **[MODEL_CAPABILITIES.md](./docs/MODEL_CAPABILITIES.md)**: Streaming & tool call guide
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: Technical deep dive
- **[QUICK_START.md](./docs/QUICK_START.md)**: Getting started guide
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)**: Deployment instructions
- **[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)**: Comprehensive troubleshooting

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [WebLLM Documentation](https://webllm.mlc.ai/)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

Built with ❤️ using Next.js and WebLLM
