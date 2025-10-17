'use client';

import { useState, useCallback, useRef } from 'react';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { processRigVedaQueryWithSteps } from '../lib/agents/ai-sdk-orchestrator';
import { AgentMessage, MessageType } from '../lib/agents/types';

interface UseAISDKAgentProps {
  model: LanguageModelV2 | null;
}

export const useAISDKAgent = ({ model }: UseAISDKAgentProps) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Add a message to the conversation
   */
  const addMessage = useCallback((
    content: string,
    role: 'user' | 'assistant',
    messageType: MessageType,
    metadata?: AgentMessage['metadata']
  ) => {
    const message: AgentMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role,
      messageType,
      content,
      timestamp: new Date(),
      metadata,
    };
    
    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  /**
   * Add a status message to keep user informed
   */
  const addStatusMessage = useCallback((content: string) => {
    addMessage(content, 'assistant', 'system');
  }, [addMessage]);

  /**
   * Process user message using AI SDK Agent system
   */
  const processUserMessage = useCallback(async (userQuery: string) => {
    if (!model) {
      addMessage(
        'System is still initializing. Please wait a moment and try again.',
        'assistant',
        'assistant'
      );
      return;
    }

    // Abort any previous run and create a new controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsProcessing(true);
    setCurrentStep('Initializing...');

    try {
      // Add user message
      addMessage(userQuery, 'user', 'user');

      // Add initial status message
      addStatusMessage('Processing your RigVeda query using AI SDK Agent system...');

      // Process the query using the AI SDK Agent orchestrator with step updates
      setCurrentStep('Initializing...');
      const result = await processRigVedaQueryWithSteps(userQuery, model, (step) => {
        console.log('🔄 AI SDK Agent step:', step);
        setCurrentStep(step.message);
        
        // Emit messages immediately for each step type
        if (step.type === 'search_complete') {
          addMessage(
            `🔍 vectorSearch("${userQuery}")`,
            'assistant',
            'search-results',
            {
              searchResults: step.data?.searchResult?.results || [],
              toolCall: {
                name: 'vector_search',
                parameters: { userQuery }
              }
            }
          );
        } else if (step.type === 'analysis_complete') {
          addStatusMessage(step.message);
        } else if (step.type === 'translation_complete') {
          addStatusMessage(step.message);
        } else if (step.type === 'additional_search') {
          addStatusMessage(step.message);
        }
      });

      if (result.success) {
        // Add the final answer
        addMessage(result.finalAnswer, 'assistant', 'assistant', {
          isComplete: true,
          searchResults: [], // Could be enhanced to include the actual search results
        });

        // Add completion status
        addStatusMessage('Query completed successfully');
        
        // Log the steps taken (for debugging)
        console.log('AI SDK Agent Steps:', result.steps);
      } else {
        // Handle error case
        addMessage(
          result.finalAnswer,
          'assistant',
          'assistant'
        );
        addStatusMessage('Query completed with errors');
      }

    } catch (error) {
      console.error('AI SDK Agent error:', error);
      addMessage(
        'I apologize, but I encountered an error processing your request. Please try again.',
        'assistant',
        'assistant'
      );
      addStatusMessage('Error occurred during processing');
    } finally {
      setIsProcessing(false);
      setCurrentStep('');
    }
  }, [model, addMessage, addStatusMessage]);

  /**
   * Reset the conversation
   */
  const resetConversation = useCallback(() => {
    setMessages([]);
    setIsProcessing(false);
    setCurrentStep('');
  }, []);

  return {
    messages,
    isProcessing,
    currentStep,
    processUserMessage,
    resetConversation,
  };
};
