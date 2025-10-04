# Model Capabilities Guide

## Streaming Support

All models loaded via WebLLM now support **streaming responses**. This means you'll see the AI's response appear word-by-word in real-time, similar to ChatGPT, rather than waiting for the complete response.

### How it works:
- When you send a message, an empty assistant message is immediately created
- As the model generates tokens, the message updates in real-time
- The response streams smoothly with no visible "jumps"
- Better user experience with immediate feedback

### Visual Indicator:
In the chat header, you'll see a ⚡ badge indicating streaming is enabled.

## Tool/Function Calling Support

Some models support **tool calls** (also known as function calling), which allows the AI to:
- Call external functions/APIs
- Perform structured data extraction
- Execute specific actions based on user requests
- Return structured JSON responses

### Models with Tool Call Support:

Based on model ID patterns, the following model families support tool calls:

1. **Llama 3.1+** models
   - `llama-3.1-*`
   - `llama-3.2-*`
   
2. **Hermes** models
   - Any model with "hermes" in the name
   
3. **Mistral** models
   - Any model with "mistral" in the name
   
4. **Qwen 2.5** models
   - `qwen2.5-*`

### Visual Indicator:
In the chat header, you'll see a 🔧 badge if the loaded model supports tool calls.

## Checking Model Capabilities

The application automatically checks model capabilities when a model is loaded. You can see this information:

1. **In the UI**: Look at the badges in the chat header next to the model name
2. **In the Console**: Open browser DevTools and check the console for "Model capabilities:" log

### Example Console Output:
```javascript
Model capabilities: {
  supportsToolCalls: true,
  supportsStreaming: true,
  modelId: "Llama-3.1-8B-Instruct-q4f32_1-MLC"
}
```

## How to Use Tool Calls

If your model supports tool calls, you can provide function definitions in your prompts. Here's a conceptual example:

```javascript
// Future enhancement: Tool call API
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" }
        }
      }
    }
  }
];
```

**Note**: Full tool calling API integration is a future enhancement. Currently, the app only detects which models support this capability.

## Performance Considerations

### Streaming
- **Pros**: Better UX, immediate feedback, feels faster
- **Cons**: Slightly more CPU usage during generation
- **Impact**: Minimal - the browser handles updates efficiently

### Model Size vs Speed
- Larger models (7B+): Better quality but slower generation
- Smaller models (1B-3B): Faster but may sacrifice quality
- Tool-call capable models: Usually larger, more capable

## Testing Streaming

To verify streaming is working:

1. Load a model
2. Ask a question that requires a long response
3. Watch the response appear token-by-token
4. You should see smooth, continuous text appearing

Example prompts for testing:
- "Write a detailed story about a robot learning to paint"
- "Explain quantum computing in 500 words"
- "Generate a Python script with detailed comments"

## Troubleshooting

### Streaming not visible
- **Issue**: Response appears all at once
- **Cause**: Very fast model or short response
- **Solution**: Try longer prompts or larger models

### Tool calls not working
- **Status**: Tool call execution is not yet implemented
- **Current**: Only capability detection is available
- **Future**: Full tool calling API will be added

## Future Enhancements

Planned improvements for model capabilities:

1. **Full Tool Calling API**
   - Define custom functions
   - Automatic function execution
   - Structured response handling

2. **Model Comparison**
   - Side-by-side capability comparison
   - Performance benchmarks
   - Quality assessment

3. **Dynamic Capability Testing**
   - Runtime capability detection
   - Test prompts for verification
   - Automatic optimization

4. **Advanced Streaming**
   - Token-by-token timing
   - Response speed metrics
   - Adaptive streaming rate

## Developer Information

### Capability Detection Logic

The app uses pattern matching to detect tool call support:

```typescript
const toolCallPatterns = [
  'llama-3.1',
  'llama-3.2',
  'hermes',
  'mistral',
  'qwen2.5',
];

const supportsToolCalls = toolCallPatterns.some(pattern => 
  modelId.toLowerCase().includes(pattern)
);
```

### Streaming Implementation

Streaming is implemented using WebLLM's native streaming support:

```typescript
const completion = await engine.chat.completions.create({
  messages: [...],
  stream: true, // Enable streaming
});

for await (const chunk of completion) {
  const delta = chunk.choices[0]?.delta?.content || '';
  // Update UI with delta
}
```

### Adding New Capability Detection

To add detection for new capabilities:

1. Update the `checkModelCapabilities` function in `app/hooks/useWebLLM.ts`
2. Add new capability to `ModelCapabilities` interface
3. Update UI to show the new capability badge
4. Document the new capability in this file

---

**Last Updated**: October 4, 2025

