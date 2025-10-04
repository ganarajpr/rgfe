'use client';

import { useEffect, useState } from 'react';
import { useWebLLM } from './hooks/useWebLLM';
import LLMSelector from './components/LLMSelector';
import LoadingScreen from './components/LoadingScreen';
import ChatInterface from './components/ChatInterface';

export default function Home() {
  const {
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
  } = useWebLLM();

  const [isInitialCheck, setIsInitialCheck] = useState(true);

  useEffect(() => {
    const initializeModel = async () => {
      // Check if there's a previously loaded model
      const existingModel = checkForExistingModel();
      
      if (existingModel) {
        // Try to automatically load the previously selected model
        await loadModel(existingModel);
        // If it fails, the model selector will automatically show
        // since isModelLoaded will remain false
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
      resetChat();
    }
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

  // Show chat interface once model is loaded
  return (
    <ChatInterface
      onSendMessage={sendMessage}
      onStopGeneration={stopGeneration}
      messages={messages}
      isGenerating={isGenerating}
      onNewChat={handleNewChat}
      modelName={currentModel}
      modelCapabilities={modelCapabilities}
    />
  );
}
