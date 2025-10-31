'use client';

import { useState, useCallback, useRef } from 'react';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AISDKOrchestrator } from '../lib/agents/ai-sdk-orchestrator';
import { AgentMessage, MessageType, SearchResult } from '../lib/agents/types';

interface UseAISDKAgentProps {
  model: LanguageModelV2 | null;
}

export const useAISDKAgent = ({ model }: UseAISDKAgentProps) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const orchestratorRef = useRef<AISDKOrchestrator | null>(null);
  const isInitializedRef = useRef<boolean>(false);

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

      // Initialize orchestrator if needed
      if (!orchestratorRef.current) {
        try {
          orchestratorRef.current = new AISDKOrchestrator(model);
          isInitializedRef.current = false;
          console.log('✅ Orchestrator created:', {
            hasInitialize: typeof orchestratorRef.current.initialize === 'function',
            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(orchestratorRef.current))
          });
        } catch (error) {
          console.error('❌ Failed to create orchestrator:', error);
          addMessage(
            'Failed to initialize system. Please refresh the page.',
            'assistant',
            'assistant'
          );
          setIsProcessing(false);
          return;
        }
      }
      
      // Ensure the orchestrator exists
      if (!orchestratorRef.current) {
        console.error('❌ Orchestrator is null after creation');
        addMessage(
          'System initialization error. Please refresh the page.',
          'assistant',
          'assistant'
        );
        setIsProcessing(false);
        return;
      }

      // Try to initialize if not already initialized
      if (!isInitializedRef.current) {
        try {
          // Check if initialize method exists
          const hasInitialize = typeof orchestratorRef.current.initialize === 'function';
          
          if (!hasInitialize) {
            console.error('❌ Orchestrator initialize method not available');
            console.error('Orchestrator instance:', orchestratorRef.current);
            console.error('Prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(orchestratorRef.current)));
            console.error('Instance properties:', Object.keys(orchestratorRef.current));
            
            // Try to proceed without initialization (searcher might already be initialized)
            console.warn('⚠️ Proceeding without explicit initialization - searcher may already be initialized');
            isInitializedRef.current = true;
          } else {
            // Initialize the orchestrator
            await orchestratorRef.current.initialize((step) => {
              console.log('🔄 AI SDK Agent initialization step:', step);
              setCurrentStep(step.message);
              
              // Only emit messages for initialization steps (not processing steps)
              if (step.type === 'initialization') {
                addStatusMessage(step.message);
              } else if (step.type === 'initialization_complete') {
                addStatusMessage(step.message);
              }
            });
            isInitializedRef.current = true;
          }
        } catch (error) {
          console.error('❌ Failed to initialize orchestrator:', error);
          // Continue anyway - searcher might already be initialized from previous sessions
          console.warn('⚠️ Continuing without initialization - attempting to proceed');
          isInitializedRef.current = true;
        }
      }

      // Ensure orchestrator is initialized before processing
      if (!orchestratorRef.current) {
        console.error('❌ Orchestrator is null');
        addMessage(
          'System initialization error. Please refresh the page.',
          'assistant',
          'assistant'
        );
        setIsProcessing(false);
        return;
      }

      // Process the query using the AI SDK Agent orchestrator
      setCurrentStep('Processing query...');
      
      // Pass the same progress callback to processQuery
      const result = await orchestratorRef.current!.processQuery(userQuery, (step) => {
        console.log('🔄 AI SDK Agent step:', step);
        setCurrentStep(step.message);
        
        // Emit messages immediately for each step type
        if (step.type === 'agent_start') {
          addStatusMessage(step.message);
        } else if (step.type === 'agent_complete') {
          addStatusMessage(step.message);
        } else if (step.type === 'notification') {
          addStatusMessage(step.message);
        } else if (step.type === 'routing') {
          addStatusMessage(step.message);
        } else if (step.type === 'search') {
          addStatusMessage(step.message);
        } else if (step.type === 'search_complete') {
          const searchResult = step.data?.searchResult as { searchResults?: SearchResult[]; metadata?: { newResults?: SearchResult[] } } | undefined;
          const searchResults = searchResult?.searchResults || [];
          const newResultsCount = searchResult?.metadata?.newResults?.length || searchResults.length;
          
          addMessage(
            `🔍 vectorSearch("${userQuery}")`,
            'assistant',
            'search-results',
            {
              searchResults: searchResults,
              toolCall: {
                name: 'vector_search',
                parameters: { userQuery }
              }
            }
          );
          
          if (newResultsCount > 0) {
            addStatusMessage(`Found ${newResultsCount} verses`);
          }
        } else if (step.type === 'loop_iteration') {
          addStatusMessage(step.message);
        } else if (step.type === 'verses_accumulated') {
          addStatusMessage(step.message);
        } else if (step.type === 'analysis') {
          addStatusMessage(step.message);
        } else if (step.type === 'analysis_complete') {
          const data = step.data as { 
            needsMoreSearch?: boolean; 
            relevantVerseCount?: number;
            relevantVerses?: SearchResult[];
            filteredVerses?: SearchResult[];
          } | undefined;
          
          // Only show verses with analysis reasoning if there are any verses
          // Don't duplicate - search results were already shown in search_complete
          const allVerses = [...(data?.relevantVerses || []), ...(data?.filteredVerses || [])];
          if (allVerses.length > 0 && allVerses.some(v => v.analysisReasoning)) {
            addMessage(
              `📊 Verse Analysis Results`,
              'assistant',
              'search-results',
              {
                searchResults: allVerses,
                toolCall: {
                  name: 'vector_search',
                  parameters: { userQuery }
                }
              }
            );
          }
          
          if (data?.needsMoreSearch) {
            addStatusMessage(`Analysis: Need more search - ${data.relevantVerseCount || 0} relevant verses found`);
          } else {
            addStatusMessage(`Analysis complete: ${data?.relevantVerseCount || 0} relevant verses selected`);
          }
        } else if (step.type === 'additional_search') {
          addStatusMessage(step.message);
        } else if (step.type === 'translation') {
          addStatusMessage(step.message);
        } else if (step.type === 'translation_complete') {
          const data = step.data as { selectedVerses?: number } | undefined;
          addStatusMessage(`Translation complete: ${data?.selectedVerses || 0} verses selected`);
        } else if (step.type === 'generation') {
          addStatusMessage(step.message);
        } else if (step.type === 'complete') {
          addStatusMessage(step.message);
        } else if (step.type === 'error') {
          addStatusMessage(step.message);
        }
      });

      // Extract search results from the steps for metadata
      const searchResults: SearchResult[] = [];
      for (const step of result.steps) {
        if (step.tool === 'vectorSearch' || step.tool === 'analyze') {
          const stepResult = step.result as { searchResults?: SearchResult[]; relevantVerses?: SearchResult[] } | undefined;
          const results = stepResult?.searchResults || stepResult?.relevantVerses || [];
          searchResults.push(...results);
        }
      }

      if (result.success && result.finalAnswer) {
        // Add the final answer
        addMessage(result.finalAnswer, 'assistant', 'assistant', {
          isComplete: true,
          searchResults: searchResults,
        });

        // Add completion status
        addStatusMessage('Query completed successfully');
        
        // Log the steps taken (for debugging)
        console.log('AI SDK Agent Steps:', result.steps);
      } else {
        // Handle error case
        addMessage(
          result.finalAnswer || 'I encountered an error processing your request.',
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
