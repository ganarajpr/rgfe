'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWebLLM } from './hooks/useWebLLM';
import { useAISDKAgent } from './hooks/useAISDKAgent';
import { createWebLLMProvider } from './lib/webllm-provider';
import { createGeminiProvider } from './lib/gemini-provider';
import LLMSelector, { ModelSelection, ProviderType } from './components/LLMSelector';
import LoadingScreen from './components/LoadingScreen';
import AISDKChatInterface from './components/AISDKChatInterface';

export default function AISDKPage() {
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

  // Create AI SDK provider based on provider type
  const aiModel = useMemo(() => {
    if (providerType === 'gemini' && geminiApiKey) {
      console.log('Creating Gemini provider for AI SDK');
      return createGeminiProvider(geminiApiKey);
    } else if (providerType === 'webllm' && engine && currentModel && isModelLoaded) {
      console.log('Creating WebLLM provider for AI SDK');
      return createWebLLMProvider(engine, currentModel);
    }
    return null;
  }, [providerType, geminiApiKey, engine, currentModel, isModelLoaded]);

  // Initialize AI SDK Agent system
  const {
    messages,
    isProcessing,
    currentStep,
    processUserMessage,
    resetConversation,
  } = useAISDKAgent({ 
    model: aiModel
  });

  useEffect(() => {
    const initializeModel = async () => {
      // Check for saved provider type
      const savedProvider = localStorage.getItem('provider_type') as ProviderType | null;
      const savedGeminiKey = localStorage.getItem('gemini_api_key');
      
      if (savedProvider === 'gemini' && savedGeminiKey) {
        console.log('Found saved Gemini configuration for AI SDK');
        setProviderType('gemini');
        setGeminiApiKey(savedGeminiKey);
        setGeminiModelReady(true);
      } else if (savedProvider === 'webllm') {
        // Check if there's a previously loaded WebLLM model
        const existingModel = checkForExistingModel();
        
        if (existingModel) {
          // If there's a cached model, try to load it
          console.log('Found cached WebLLM model for AI SDK:', existingModel);
          setProviderType('webllm');
          const success = await loadModel(existingModel);
          if (!success) {
            // If loading fails, clear the invalid model from cache
            console.log('Failed to load cached model, clearing cache');
            await clearModelCache();
            setProviderType(null);
          }
        } else {
          console.log('No cached WebLLM model found for AI SDK');
        }
      } else {
        console.log('No saved provider configuration found for AI SDK');
      }
      
      setIsInitialCheck(false);
    };
    
    initializeModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectModel = async (selection: ModelSelection) => {
    console.log('Model selection for AI SDK:', selection);
    
    if (selection.provider === 'gemini') {
      // Save provider type and API key
      localStorage.setItem('provider_type', 'gemini');
      if (selection.apiKey) {
        localStorage.setItem('gemini_api_key', selection.apiKey);
        setGeminiApiKey(selection.apiKey);
      }
      setProviderType('gemini');
      setGeminiModelReady(true);
      console.log('Gemini provider configured with API key for AI SDK');
    } else if (selection.provider === 'webllm') {
      // Save provider type
      localStorage.setItem('provider_type', 'webllm');
      setProviderType('webllm');
      await loadModel(selection.modelId);
      // If model loading fails, the selector will remain visible
      // since isModelLoaded stays false
    }
  };

  const handleNewChat = () => {
    const confirmNewChat = messages.length === 0 || globalThis.confirm(
      'Are you sure you want to start a new chat? This will clear all messages.'
    );
    
    if (confirmNewChat) {
      resetConversation();
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!aiModel) {
      console.error('Model not ready for AI SDK');
      return;
    }
    
    if (providerType === 'gemini' && !geminiModelReady) {
      console.error('Gemini model not ready for AI SDK');
      return;
    }
    
    if (providerType === 'webllm' && !isModelLoaded) {
      console.error('WebLLM model not loaded for AI SDK');
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

  // Show loading screen during initial check or model loading
  if (isInitialCheck || (providerType === 'webllm' && isLoading)) {
    return (
      <LoadingScreen
        progress={loadingProgress}
        message={loadingMessage || 'Initializing AI SDK Agent system...'}
      />
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

  // Show AI SDK Agent chat interface once model is ready
  const displayModelName = providerType === 'gemini' 
    ? 'Gemini 2.5 Flash (AI SDK)' 
    : `${currentModel || 'Unknown'} (AI SDK)`;

  return (
    <AISDKChatInterface
      onSendMessage={handleSendMessage}
      messages={messages}
      isProcessing={isProcessing}
      currentStep={currentStep}
      onNewChat={handleNewChat}
      onClearCache={handleClearCache}
      modelName={displayModelName}
    />
  );
}
