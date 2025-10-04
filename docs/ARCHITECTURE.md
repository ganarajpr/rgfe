# Architecture Documentation

## Overview

This document describes the architecture of the Frontend AI Chat Interface application.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                     │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │            Next.js Application                    │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │          UI Components                      │  │  │
│  │  │  • ChatInterface                           │  │  │
│  │  │  • LLMSelector                             │  │  │
│  │  │  • LoadingScreen                           │  │  │
│  │  │  • ChatMessage                             │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │          State Management                   │  │  │
│  │  │  • useWebLLM Hook                          │  │  │
│  │  │  • React State                             │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │          WebLLM Integration                 │  │  │
│  │  │  • Model Loading                           │  │  │
│  │  │  • Inference Engine                        │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Browser Storage                          │  │
│  │  • IndexedDB (Model Cache)                       │  │
│  │  • LocalStorage (Preferences)                    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │          WebGPU                                   │  │
│  │  • Hardware Acceleration                         │  │
│  │  • Model Inference                               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Page Component (`app/page.tsx`)

**Responsibility**: Application orchestration and state management

- Checks for existing model selection
- Controls application flow (selector → loading → chat)
- Manages transitions between states

**State Flow**:
```
Initial Load → Check LocalStorage → Model Found?
                                    ├─ Yes → Load Model → Chat Interface
                                    └─ No  → Model Selector → Load Model → Chat Interface
```

### 2. Custom Hook (`app/hooks/useWebLLM.ts`)

**Responsibility**: WebLLM integration and LLM operations

**Key Functions**:
- `loadModel()`: Initializes and loads LLM with progress tracking
- `sendMessage()`: Handles message sending and response generation
- `resetChat()`: Clears conversation history
- `checkForExistingModel()`: Retrieves saved model preference

**State Management**:
- Loading state
- Model loaded state
- Messages array
- Generation state
- Progress tracking

### 3. UI Components

#### ChatInterface (`app/components/ChatInterface.tsx`)
- Main chat layout
- Message list rendering
- Input handling
- Suggestion prompts
- Auto-scroll behavior

#### LLMSelector (`app/components/LLMSelector.tsx`)
- Model selection UI
- Model information display
- Selection confirmation

#### LoadingScreen (`app/components/LoadingScreen.tsx`)
- Progress visualization
- Loading animations
- Status messages

#### ChatMessage (`app/components/ChatMessage.tsx`)
- Message rendering
- Markdown parsing (for AI responses)
- Role-based styling

## Data Flow

### Message Lifecycle

```
User Input → ChatInterface
           ↓
       useWebLLM.sendMessage()
           ↓
       Add User Message to State
           ↓
       WebLLM.chat.completions.create()
           ↓
       Receive AI Response
           ↓
       Add Assistant Message to State
           ↓
       ChatInterface Renders Updated Messages
```

### Model Loading Flow

```
User Selects Model → LLMSelector
                   ↓
               loadModel(modelId)
                   ↓
           WebLLM.CreateMLCEngine()
                   ↓
           Progress Callbacks → Update UI
                   ↓
           Model Loaded → Cache in IndexedDB
                   ↓
           Save Preference to LocalStorage
                   ↓
           Show Chat Interface
```

## Storage Strategy

### LocalStorage
```typescript
{
  "selectedModel": "model-id-string"  // Last selected model
}
```

### IndexedDB (Managed by WebLLM)
```
- Model weights
- Model configuration
- Tokenizer data
```

**Note**: IndexedDB storage is automatically managed by WebLLM and can be 2-8GB depending on model size.

## State Management

### Application State
```typescript
interface AppState {
  isLoading: boolean;              // Model loading
  isModelLoaded: boolean;          // Model ready
  loadingProgress: number;         // 0-100
  loadingMessage: string;          // Status text
  messages: Message[];             // Chat history
  isGenerating: boolean;           // Response generation
  currentModel: string;            // Loaded model ID
}
```

### Message State
```typescript
interface Message {
  id: string;                      // Unique identifier
  role: 'user' | 'assistant';      // Message sender
  content: string;                 // Message text
  timestamp: Date;                 // Creation time
}
```

## Performance Considerations

### 1. Model Caching
- Models cached in IndexedDB after first download
- Subsequent loads are much faster (seconds vs minutes)

### 2. Memory Management
- Only one model loaded at a time
- Messages kept in memory (could be optimized with pagination)
- WebGPU handles memory efficiently

### 3. Rendering Optimization
- Markdown parsing memoized per message
- Auto-scroll only when new messages arrive
- Textarea height auto-adjusts without layout thrashing

### 4. Bundle Size
- WebLLM loaded dynamically
- Components code-split by Next.js
- Tailwind CSS purged in production

## Security Considerations

### 1. Client-Side Only
- No backend = no server-side vulnerabilities
- No API keys to expose
- No data transmission to external servers

### 2. XSS Protection
- Markdown rendering via `marked` with sanitization
- User input escaped by React
- dangerouslySetInnerHTML only for markdown (AI responses)

### 3. Data Privacy
- All data stays in browser
- No telemetry or analytics
- Model cache can be cleared via browser settings

## Browser Compatibility

### Required Features
- WebGPU (hardware acceleration)
- IndexedDB (model storage)
- LocalStorage (preferences)
- ES2020+ JavaScript features

### Minimum Requirements
- Chrome 113+
- 8GB RAM (for larger models)
- ~5GB free storage (for model cache)

## Future Enhancements

### Potential Improvements
1. **Conversation Management**
   - Multiple chat sessions
   - Export/import conversations
   - Search within conversations

2. **Model Management**
   - Clear cached models
   - Model comparison
   - Custom model support

3. **Advanced Features**
   - ✅ Streaming responses (implemented)
   - ✅ Model capability detection (implemented)
   - Token usage display
   - Temperature/parameter controls
   - System prompts
   - Full tool/function calling API

4. **UI Enhancements**
   - Code syntax highlighting
   - Copy code button
   - Message editing
   - Regenerate response

5. **Performance**
   - Message pagination
   - Virtual scrolling
   - Progressive Web App (PWA)
   - Service Worker caching

## Development Guidelines

### Adding New Models
1. Check WebLLM compatibility
2. Add to `availableModels` array in `LLMSelector.tsx`
3. Test loading and inference
4. Update documentation

### Styling Conventions
- Use Tailwind utility classes
- Consistent dark mode support
- Responsive design first
- Accessible color contrasts

### State Updates
- Always update state immutably
- Use functional setState for state derived from previous state
- Keep state as local as possible

### Error Handling
- User-friendly error messages
- Console logging for debugging
- Graceful degradation when possible

## Testing Strategy

### Manual Testing Checklist
- [ ] Model selection works
- [ ] Model loads with progress
- [ ] Chat input and submission
- [ ] AI responses render correctly
- [ ] Markdown formatting works
- [ ] Dark mode toggles properly
- [ ] Mobile responsive
- [ ] Browser refresh preserves model
- [ ] New chat clears messages
- [ ] Error states display properly

### Browser Testing
- [ ] Chrome (latest)
- [ ] Edge (latest)
- [ ] Opera (latest)
- [ ] Mobile browsers (Chrome Android)

## Troubleshooting

### Common Issues

**Issue**: Model fails to load
- **Cause**: WebGPU not supported or not enabled
- **Solution**: Check browser compatibility, enable flags

**Issue**: Out of memory
- **Cause**: Model too large for available RAM
- **Solution**: Use smaller model or close other tabs

**Issue**: Slow inference
- **Cause**: CPU fallback or insufficient GPU
- **Solution**: Ensure WebGPU enabled, try smaller model

**Issue**: IndexedDB quota exceeded
- **Cause**: Multiple large models cached
- **Solution**: Clear browser storage for site

