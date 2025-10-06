'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWebLLM } from './hooks/useWebLLM';
import { useMultiAgent } from './hooks/useMultiAgent';
import { createWebLLMProvider } from './lib/webllm-provider';
import LLMSelector from './components/LLMSelector';
import LoadingScreen from './components/LoadingScreen';
import AgentChatInterface from './components/AgentChatInterface';

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

  // Create AI SDK provider from our already-loaded WebLLM engine
  const aiModel = useMemo(() => {
    if (!engine || !currentModel || !isModelLoaded) return null;
    return createWebLLMProvider(engine, currentModel);
  }, [engine, currentModel, isModelLoaded]);

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

  useEffect(() => {
    const initializeModel = async () => {
      // Check if there's a previously loaded model
      const existingModel = checkForExistingModel();
      
      if (existingModel) {
        // If there's a cached model, try to load it
        console.log('Found cached model:', existingModel);
        const success = await loadModel(existingModel);
        if (!success) {
          // If loading fails, clear the invalid model from cache
          console.log('Failed to load cached model, clearing cache');
          await clearModelCache();
        }
      } else {
        // No cached model found, don't auto-load anything
        console.log('No cached model found');
      }
      
      setIsInitialCheck(false);
    };
    
    initializeModel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectModel = async (modelId: string) => {
    await loadModel(modelId);
    // If model loading fails, the selector will remain visible
    // since isModelLoaded stays false
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
    if (!aiModel || !isModelLoaded) {
      console.error('Model not ready');
      return;
    }
    await processUserMessage(message);
  };

  // Show loading screen during initial check or model loading
  if (isInitialCheck || isLoading) {
    return (
      <LoadingScreen
        progress={loadingProgress}
        message={loadingMessage || 'Initializing...'}
      />
    );
  }

  // Show model selector if no model is loaded (initial or after error)
  if (!isModelLoaded) {
    return <LLMSelector onSelectModel={handleSelectModel} isOpen={true} />;
  }

  // Show multi-agent chat interface once model is loaded
  return (
    <AgentChatInterface
      onSendMessage={handleSendMessage}
      messages={messages}
      isProcessing={isProcessing}
      currentAgent={currentAgent}
      onNewChat={handleNewChat}
      onClearCache={clearModelCache}
      modelName={currentModel}
    />
  );
}
