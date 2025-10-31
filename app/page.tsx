'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWebLLM } from './hooks/useWebLLM';
import { useMultiAgent } from './hooks/useMultiAgent';
import { createWebLLMProvider } from './lib/webllm-provider';
import { createGeminiProvider } from './lib/gemini-provider';
import LLMSelector, { ModelSelection, ProviderType } from './components/LLMSelector';
import LoadingScreen from './components/LoadingScreen';
import AgentChatInterface from './components/AgentChatInterface';
import SystemSelector from './components/SystemSelector';

export default function Home() {
  const {
    isLoading,
    isModelLoaded,
    loadingProgress,
    loadingMessage,
    currentModel,
    loadModel,
    checkForExistingModel,
    clearModelCache,
    engine,
  } = useWebLLM();

  const [isInitialCheck, setIsInitialCheck] = useState(true);
  const [providerType, setProviderType] = useState<ProviderType | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(null);
  const [geminiModelReady, setGeminiModelReady] = useState(false);
  
  // Embedding service initialization state
  const [isEmbeddingLoading, setIsEmbeddingLoading] = useState(false);
  const [isEmbeddingReady, setIsEmbeddingReady] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState(0);
  const [embeddingMessage, setEmbeddingMessage] = useState('');
  const [embeddingError, setEmbeddingError] = useState<string | null>(null);

  // Create AI SDK provider based on provider type
  const aiModel = useMemo(() => {
    if (providerType === 'gemini' && geminiApiKey) {
      console.log('Creating Gemini provider');
      return createGeminiProvider(geminiApiKey);
    } else if (providerType === 'webllm' && engine && currentModel && isModelLoaded) {
      console.log('Creating WebLLM provider');
      return createWebLLMProvider(engine, currentModel);
    }
    return null;
  }, [providerType, geminiApiKey, engine, currentModel, isModelLoaded]);

  // Initialize multi-agent system
  const {
    messages,
    isProcessing,
    currentAgent,
    processUserMessage,
    resetConversation,
  } = useMultiAgent({ 
    model: aiModel
  });

  // Initialize embedding service
  const initializeEmbeddingService = async () => {
    if (typeof window === 'undefined') {
      console.log('Server-side, skipping embedding initialization');
      return;
    }

    try {
      setIsEmbeddingLoading(true);
      setEmbeddingError(null);
      console.log('🚀 Starting embedding service initialization...');

      const { getSearchTool } = await import('./lib/tools/search-tool');
      
      const searchTool = getSearchTool({
        binaryFilePath: '/smrthi-rgveda-test-512d.bin',
        defaultLimit: 5,
        minScore: 0.0,
        useEmbeddings: true,
      });

      await searchTool.initialize((progress, message) => {
        setEmbeddingProgress(progress);
        setEmbeddingMessage(message);
        console.log(`Embedding service: ${progress}% - ${message}`);
      });

      setIsEmbeddingReady(true);
      setIsEmbeddingLoading(false);
      console.log('✅ Embedding service ready');
    } catch (error) {
      console.error('❌ Failed to initialize embedding service:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setEmbeddingError(errorMessage);
      setIsEmbeddingLoading(false);
      setIsEmbeddingReady(false);
    }
  };

  useEffect(() => {
    const initializeModel = async () => {
      // Check for saved provider type
      const savedProvider = localStorage.getItem('provider_type') as ProviderType | null;
      const savedGeminiKey = localStorage.getItem('gemini_api_key');
      
      if (savedProvider === 'gemini' && savedGeminiKey) {
        console.log('Found saved Gemini configuration');
        setProviderType('gemini');
        setGeminiApiKey(savedGeminiKey);
        setGeminiModelReady(true);
        
        // Initialize embedding service
        await initializeEmbeddingService();
      } else if (savedProvider === 'webllm') {
        // Check if there's a previously loaded WebLLM model
        const existingModel = checkForExistingModel();
        
        if (existingModel) {
          // If there's a cached model, try to load it
          console.log('Found cached WebLLM model:', existingModel);
          setProviderType('webllm');
          const success = await loadModel(existingModel);
          if (success) {
            // Initialize embedding service after model loads
            await initializeEmbeddingService();
          } else {
            // If loading fails, clear the invalid model from cache
            console.log('Failed to load cached model, clearing cache');
            await clearModelCache();
            setProviderType(null);
          }
        } else {
          console.log('No cached WebLLM model found');
        }
      } else {
        console.log('No saved provider configuration found');
      }
      
      setIsInitialCheck(false);
    };
    
    initializeModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectModel = async (selection: ModelSelection) => {
    console.log('Model selection:', selection);
    
    if (selection.provider === 'gemini') {
      // Save provider type and API key
      localStorage.setItem('provider_type', 'gemini');
      if (selection.apiKey) {
        localStorage.setItem('gemini_api_key', selection.apiKey);
        setGeminiApiKey(selection.apiKey);
      }
      setProviderType('gemini');
      setGeminiModelReady(true);
      console.log('Gemini provider configured with API key');
      
      // Initialize embedding service after model is ready
      await initializeEmbeddingService();
    } else if (selection.provider === 'webllm') {
      // Save provider type
      localStorage.setItem('provider_type', 'webllm');
      setProviderType('webllm');
      const success = await loadModel(selection.modelId);
      
      // If model loading succeeds, initialize embedding service
      if (success) {
        await initializeEmbeddingService();
      }
      // If model loading fails, the selector will remain visible
      // since isModelLoaded stays false
    }
  };

  const handleNewChat = () => {
    const confirmNewChat = messages.length === 0 || window.confirm(
      'Are you sure you want to start a new chat? This will clear all messages.'
    );
    
    if (confirmNewChat) {
      resetConversation();
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!aiModel) {
      console.error('Model not ready');
      return;
    }
    
    if (providerType === 'gemini' && !geminiModelReady) {
      console.error('Gemini model not ready');
      return;
    }
    
    if (providerType === 'webllm' && !isModelLoaded) {
      console.error('WebLLM model not loaded');
      return;
    }
    
    await processUserMessage(message);
  };

  const handleClearCache = async () => {
    if (providerType === 'webllm') {
      await clearModelCache();
    } else if (providerType === 'gemini') {
      // Clear Gemini configuration
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('provider_type');
      setGeminiApiKey(null);
      setProviderType(null);
      setGeminiModelReady(false);
    }
  };

  // Show loading screen during initial check, model loading, or embedding loading
  if (isInitialCheck || (providerType === 'webllm' && isLoading) || isEmbeddingLoading) {
    // Determine which loading stage we're in
    let displayProgress = loadingProgress;
    let displayMessage = loadingMessage || 'Initializing...';
    
    if (isEmbeddingLoading) {
      displayProgress = embeddingProgress;
      displayMessage = embeddingMessage || 'Loading embedding model...';
    }
    
    return (
      <LoadingScreen
        progress={displayProgress}
        message={displayMessage}
      />
    );
  }

  // Show error if embedding failed
  if (embeddingError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Embedding Model Initialization Failed
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              The system requires the embedding model to perform semantic search.
            </p>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 dark:text-red-200 font-mono whitespace-pre-wrap">
              {embeddingError}
            </p>
          </div>
          
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <p className="font-semibold">Please check:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Your internet connection (the model downloads from Hugging Face)</li>
              <li>The model repository exists and has all required files (config.json, model.onnx)</li>
              <li>The model ID is correct in the configuration</li>
            </ul>
          </div>
          
          <button
            onClick={() => {
              setEmbeddingError(null);
              initializeEmbeddingService();
            }}
            className="w-full mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show model selector if no provider is configured or model is not ready
  const shouldShowSelector = 
    !providerType || 
    (providerType === 'webllm' && !isModelLoaded) ||
    (providerType === 'gemini' && !geminiModelReady);

  if (shouldShowSelector) {
    return <LLMSelector onSelectModel={handleSelectModel} isOpen={true} />;
  }

  // Only show chat interface if both LLM and embedding service are ready
  if (!isEmbeddingReady) {
    return (
      <LoadingScreen
        progress={embeddingProgress}
        message={embeddingMessage || 'Waiting for embedding service...'}
      />
    );
  }

  // Show multi-agent chat interface once model is ready
  const displayModelName = providerType === 'gemini' 
    ? 'Gemini 2.5 Flash' 
    : currentModel || 'Unknown';

  return (
    <>
      <SystemSelector />
      <AgentChatInterface
        onSendMessage={handleSendMessage}
        messages={messages}
        isProcessing={isProcessing}
        currentAgent={currentAgent}
        onNewChat={handleNewChat}
        onClearCache={handleClearCache}
        modelName={displayModelName}
      />
    </>
  );
}
