'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as webllm from '@mlc-ai/web-llm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ModelCapabilities {
  supportsToolCalls: boolean;
  supportsStreaming: boolean;
  modelId: string;
}

export const useWebLLM = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [modelCapabilities, setModelCapabilities] = useState<ModelCapabilities | null>(null);
  
  const engineRef = useRef<webllm.MLCEngine | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadModel = useCallback(async (modelId: string): Promise<boolean> => {
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Initializing model...');

    try {
      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          setLoadingProgress(progress.progress * 100);
          
          // Customize loading messages based on context while preserving progress details
          let customMessage = progress.text;
          
          // If loading from cache, show cache progress details
          if (progress.text.includes('cache') || progress.text.includes('Cache')) {
            // Extract cache-specific progress (like "2/113" parts loaded)
            if (progress.text.includes('[') && progress.text.includes(']')) {
              // Extract the part count from brackets like "[2/113]"
              const bracketMatch = progress.text.match(/\[(\d+\/\d+)\]/);
              if (bracketMatch) {
                customMessage = `Loading from cache [${bracketMatch[1]}]...`;
              } else {
                customMessage = 'Loading model from cache...';
              }
            } else {
              customMessage = 'Loading model from cache...';
            }
          }
          // If downloading, show download context but keep progress details
          else if (progress.text.includes('MB loaded') || progress.text.includes('downloading')) {
            // Keep the original progress text for downloads
            customMessage = progress.text;
          }
          // If initializing, keep the original message
          else if (progress.text.includes('Initializing') || progress.text.includes('Loading')) {
            customMessage = progress.text;
          }
          // For other cases, show a generic loading message
          else {
            customMessage = progress.text;
          }
          
          setLoadingMessage(customMessage);
        },
      });

      engineRef.current = engine;
      setCurrentModel(modelId);
      setIsModelLoaded(true);
      setIsLoading(false);
      
      // Check model capabilities
      const capabilities = await checkModelCapabilities(engine, modelId);
      setModelCapabilities(capabilities);
      
      console.log('Model capabilities:', capabilities);
      
      // Store model ID in localStorage for persistence
      localStorage.setItem('selectedModel', modelId);
      return true;
    } catch (error) {
      console.error('Error loading model:', error);
      setIsLoading(false);
      
      // Clear invalid model from localStorage
      localStorage.removeItem('selectedModel');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to load model: ${errorMessage}\n\nPlease try selecting a different model.`);
      return false;
    }
  }, []);

  const checkModelCapabilities = async (
    engine: webllm.MLCEngine,
    modelId: string
  ): Promise<ModelCapabilities> => {
    // All WebLLM models support streaming
    const supportsStreaming = true;
    
    // Check if model supports tool/function calls
    // Most Llama 3.1+ and Hermes models support tool calls
    // We can test this by checking the model ID or attempting a test call
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
    
    return {
      supportsToolCalls,
      supportsStreaming,
      modelId,
    };
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!engineRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    // Create a placeholder message for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    // Add empty assistant message that we'll update as we stream
    setMessages((prev) => [...prev, assistantMessage]);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Enable streaming
      const completion = await engineRef.current.chat.completions.create({
        messages: [
          ...messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          { role: 'user', content },
        ],
        stream: true, // Enable streaming
      });

      let fullContent = '';

      // Process the stream
      for await (const chunk of completion) {
        // Check if generation was cancelled
        if (abortControllerRef.current?.signal.aborted) {
          fullContent += '\n\n[Response stopped by user]';
          break;
        }

        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          // Update the message content in real-time
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullContent }
                : msg
            )
          );
        }
      }

      // If no content was received, show an error
      if (!fullContent) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: 'No response received.' }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error generating response:', error);
      // Check if it was cancelled
      if (abortControllerRef.current?.signal.aborted) {
        // Generation was stopped, this is expected
        return;
      }
      // Update the placeholder message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [messages]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
  }, []);

  const checkForExistingModel = useCallback(() => {
    const savedModel = localStorage.getItem('selectedModel');
    return savedModel;
  }, []);

  /**
   * Cleanup function to unload model and free memory
   */
  const unloadModel = useCallback(async () => {
    if (engineRef.current) {
      try {
        console.log('🧹 Unloading model from memory...');
        
        // Stop any ongoing generation
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        
        // Unload the model using WebLLM's unload method
        await engineRef.current.unload();
        
        // Clear the engine reference
        engineRef.current = null;
        
        // Reset state
        setIsModelLoaded(false);
        setCurrentModel('');
        setModelCapabilities(null);
        
        console.log('✅ Model unloaded successfully');
      } catch (error) {
        console.error('❌ Error unloading model:', error);
        // Even if there's an error, clear the reference to prevent memory leaks
        engineRef.current = null;
      }
    }
  }, []);

  /**
   * Set up cleanup on tab close/refresh
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Unload model synchronously when tab is closing
      if (engineRef.current) {
        console.log('🧹 Tab closing - cleaning up model...');
        
        // Stop any ongoing generation
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        // Try to unload the model
        // Note: This might not complete if the tab closes too quickly,
        // but the browser should clean up GPU resources automatically
        try {
          void engineRef.current.unload();
        } catch {
          // Silently fail - tab is closing anyway
        }
        
        // Clear references
        engineRef.current = null;
        abortControllerRef.current = null;
      }
    };

    const handleUnload = () => {
      // Final cleanup when page is actually unloading
      if (engineRef.current) {
        try {
          void engineRef.current.unload();
        } catch {
          // Silently fail - page is unloading anyway
        }
        engineRef.current = null;
      }
      abortControllerRef.current = null;
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    // Cleanup function that runs when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      
      // Unload model when component unmounts (e.g., navigation)
      if (engineRef.current) {
        console.log('🧹 Component unmounting - cleaning up model...');
        try {
          void engineRef.current.unload();
        } catch (error) {
          console.error('Error during unmount cleanup:', error);
        }
        engineRef.current = null;
      }
      
      // Clear abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount/unmount

  return {
    isLoading,
    isModelLoaded,
    loadingProgress,
    loadingMessage,
    messages,
    isGenerating,
    currentModel,
    modelCapabilities,
    loadModel,
    sendMessage,
    stopGeneration,
    resetChat,
    checkForExistingModel,
    unloadModel, // Expose unloadModel for manual cleanup
    engine: engineRef.current, // Expose engine for multi-agent system
  };
};

