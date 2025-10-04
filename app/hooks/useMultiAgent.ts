'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { OrchestratorAgent } from '../lib/agents/orchestrator';
import { SearcherAgent } from '../lib/agents/searcher';
import { GeneratorAgent } from '../lib/agents/generator';
import { 
  AgentMessage, 
  AgentContext, 
  SearchResult, 
  MessageType,
  AgentRole 
} from '../lib/agents/types';

interface UseMultiAgentProps {
  model: LanguageModelV2 | null;
}

export const useMultiAgent = ({ model }: UseMultiAgentProps) => {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentRole | null>(null);
  
  // Initialize agents with refs
  const orchestratorRef = useRef<OrchestratorAgent | null>(null);
  const searcherRef = useRef<SearcherAgent | null>(null);
  const generatorRef = useRef<GeneratorAgent | null>(null);

  // Update agent instances when model changes
  useEffect(() => {
    if (model) {
      orchestratorRef.current = new OrchestratorAgent(model);
      searcherRef.current = new SearcherAgent(model);
      generatorRef.current = new GeneratorAgent(model);
    }
  }, [model]);
  
  const searchIterationRef = useRef<number>(0);
  const currentSearchResultsRef = useRef<SearchResult[]>([]);

  /**
   * Add a message to the conversation
   */
  const addMessage = useCallback((
    content: string,
    role: AgentRole | 'user' | 'assistant',
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
  const addStatusMessage = useCallback((content: string, fromAgent: AgentRole) => {
    addMessage(content, fromAgent, 'system', { fromAgent });
  }, [addMessage]);

  /**
   * Main process that orchestrates the multi-agent flow
   */
  const processUserMessage = useCallback(async (userQuery: string) => {
    // Check if agents are initialized
    if (!orchestratorRef.current || !searcherRef.current || !generatorRef.current) {
      console.error('Agents not initialized');
      addMessage(
        'System is still initializing. Please wait a moment and try again.',
        'assistant',
        'assistant'
      );
      return;
    }

    setIsProcessing(true);
    searchIterationRef.current = 0;
    currentSearchResultsRef.current = [];

    try {
      // Add user message
      addMessage(userQuery, 'user', 'user');

      // Step 1: Send to Orchestrator for classification
      setCurrentAgent('orchestrator');
      addStatusMessage('🤖 Analyzing your query...', 'orchestrator');

      const context: AgentContext = {
        userQuery,
        conversationHistory: messages,
        currentAgent: 'orchestrator',
      };

      if (!orchestratorRef.current) {
        throw new Error('Orchestrator agent not initialized');
      }

      const orchestratorResponse = await orchestratorRef.current.processUserQuery(context);

      // If orchestrator completes (non-Sanskrit query), we're done
      if (orchestratorResponse.isComplete) {
        addMessage(orchestratorResponse.content, 'assistant', 'assistant');
        if (orchestratorResponse.statusMessage) {
          addStatusMessage(orchestratorResponse.statusMessage, 'orchestrator');
        }
        setCurrentAgent(null);
        setIsProcessing(false);
        return;
      }

      // Step 2: Route to Searcher
      if (orchestratorResponse.nextAgent === 'searcher') {
        addStatusMessage(orchestratorResponse.content, 'orchestrator');
        setCurrentAgent('searcher');

        // Perform search
        const searchContext: AgentContext = {
          ...context,
          currentAgent: 'searcher',
        };

        if (!searcherRef.current) {
          throw new Error('Searcher agent not initialized');
        }

        const searchResponse = await searcherRef.current.search(searchContext);
        currentSearchResultsRef.current = searchResponse.searchResults || [];

        if (searchResponse.statusMessage) {
          addStatusMessage(searchResponse.statusMessage, 'searcher');
        }

        // Step 3: Route to Generator
        await processGeneratorFlow(userQuery, currentSearchResultsRef.current);
      }
    } catch (error) {
      console.error('Multi-agent error:', error);
      addMessage(
        'I apologize, but I encountered an error processing your request. Please try again.',
        'assistant',
        'assistant'
      );
    } finally {
      setCurrentAgent(null);
      setIsProcessing(false);
    }
  }, [messages, addMessage, addStatusMessage]);

  /**
   * Process the generator flow (which may loop back to searcher)
   */
  const processGeneratorFlow = async (
    userQuery: string,
    searchResults: SearchResult[]
  ) => {
    setCurrentAgent('generator');
    addStatusMessage('📝 Analyzing search results and generating answer...', 'generator');

    const generatorContext: AgentContext = {
      userQuery,
      conversationHistory: messages,
      currentAgent: 'generator',
      searchResults,
    };

    if (!generatorRef.current) {
      throw new Error('Generator agent not initialized');
    }

    const generatorResponse = await generatorRef.current.generate(
      generatorContext,
      searchResults,
      searchIterationRef.current
    );

    // Check if generator needs more search
    if (generatorResponse.requiresMoreSearch && generatorResponse.nextAgent === 'searcher') {
      searchIterationRef.current++;
      
      if (generatorResponse.statusMessage) {
        addStatusMessage(generatorResponse.statusMessage, 'generator');
      }

      // Perform refined search
      setCurrentAgent('searcher');
      if (!searcherRef.current) {
        throw new Error('Searcher agent not initialized');
      }

      const refinedSearchResponse = await searcherRef.current.refineSearch(
        generatorContext,
        generatorResponse.searchQuery || '',
        currentSearchResultsRef.current
      );

      currentSearchResultsRef.current = refinedSearchResponse.searchResults || [];
      
      if (refinedSearchResponse.statusMessage) {
        addStatusMessage(refinedSearchResponse.statusMessage, 'searcher');
      }

      // Loop back to generator with new results
      await processGeneratorFlow(userQuery, currentSearchResultsRef.current);
      return;
    }

    // Generate final answer with streaming
    if (generatorResponse.isComplete) {
      // Create a placeholder message for streaming
      const assistantMessageId = `${Date.now()}-${Math.random()}`;
      const assistantMessage: AgentMessage = {
        id: assistantMessageId,
        role: 'assistant',
        messageType: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Stream the answer
      if (!generatorRef.current) {
        throw new Error('Generator agent not initialized');
      }

      let fullContent = '';
      for await (const chunk of generatorRef.current.streamAnswer(userQuery, searchResults)) {
        fullContent += chunk;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullContent }
              : msg
          )
        );
      }

      if (generatorResponse.statusMessage) {
        addStatusMessage('✅ Answer complete', 'generator');
      }
    }
  };

  /**
   * Reset the conversation
   */
  const resetConversation = useCallback(() => {
    setMessages([]);
    setCurrentAgent(null);
    setIsProcessing(false);
    searchIterationRef.current = 0;
    currentSearchResultsRef.current = [];
  }, []);

  return {
    messages,
    isProcessing,
    currentAgent,
    processUserMessage,
    resetConversation,
  };
};

