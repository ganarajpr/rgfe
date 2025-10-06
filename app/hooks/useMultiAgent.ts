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

  const searchIterationRef = useRef<number>(0);
  const currentSearchResultsRef = useRef<SearchResult[]>([]);
  const searchTermsHistoryRef = useRef<string[]>([]); // Track search terms to avoid repeats

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

  // Update agent instances when model changes
  useEffect(() => {
    if (model) {
      orchestratorRef.current = new OrchestratorAgent(model);
      searcherRef.current = new SearcherAgent(model);
      generatorRef.current = new GeneratorAgent(model);
      
      // Set up coordinator callback for searcher
      if (searcherRef.current) {
        searcherRef.current.setCoordinatorCallback((message: string) => {
          addStatusMessage(message, 'searcher');
        });
      }
    }
  }, [model, addStatusMessage]);

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
    searchTermsHistoryRef.current = []; // Reset search history for new query

    try {
      // Add user message
      addMessage(userQuery, 'user', 'user');

      // Step 1: Send to Orchestrator for classification
      setCurrentAgent('orchestrator');
      addStatusMessage('Analyzing your query...', 'orchestrator');

      const context: AgentContext = {
        userQuery,
        conversationHistory: messages,
        currentAgent: 'orchestrator',
      };

      if (!orchestratorRef.current) {
        throw new Error('Orchestrator agent not initialized');
      }

      // Log orchestrator request
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🤖 ORCHESTRATOR REQUEST');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Query:', userQuery);
      console.log('Context:', { conversationHistory: messages.length, currentAgent: 'orchestrator' });
      console.log('───────────────────────────────────────────────────────────');

      const orchestratorResponse = await orchestratorRef.current.processUserQuery(context);

      // Log orchestrator response
      console.log('🤖 ORCHESTRATOR RESPONSE');
      console.log('───────────────────────────────────────────────────────────');
      console.log('Content:', orchestratorResponse.content);
      console.log('Next Agent:', orchestratorResponse.nextAgent || 'none');
      console.log('Is Complete:', orchestratorResponse.isComplete);
      console.log('Status:', orchestratorResponse.statusMessage);
      console.log('═══════════════════════════════════════════════════════════\n');

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

        // Log searcher request
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 SEARCHER REQUEST');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('Query:', userQuery);
        console.log('Generating multiple search terms...');
        console.log('───────────────────────────────────────────────────────────');

        // Add initial status message
        addStatusMessage('Generating multiple search approaches...', 'searcher');

        const searchResponse = await searcherRef.current.search(searchContext);
        currentSearchResultsRef.current = searchResponse.searchResults || [];
        
        // Track the initial search term (extract from user query)
        searchTermsHistoryRef.current.push(userQuery);

        // Log searcher response
        console.log('🔍 SEARCHER RESPONSE');
        console.log('───────────────────────────────────────────────────────────');
        console.log('Total Results Found:', searchResponse.searchResults?.length || 0);
        console.log('Status:', searchResponse.statusMessage);
        if (searchResponse.searchResults && searchResponse.searchResults.length > 0) {
          console.log('Top Results:');
          searchResponse.searchResults.slice(0, 3).forEach((result, i) => {
            console.log(`  ${i + 1}. [${result.relevance.toFixed(3)}] ${result.title}`);
          });
        }
        console.log('═══════════════════════════════════════════════════════════\n');

        if (searchResponse.statusMessage) {
          addStatusMessage(searchResponse.statusMessage, 'searcher');
        }

        // Add verses display message if search results exist
        if (searchResponse.searchResults && searchResponse.searchResults.length > 0) {
          addMessage(
            `Found ${searchResponse.searchResults.length} relevant verses from Sanskrit texts.`,
            'orchestrator',
            'verses',
            { searchResults: searchResponse.searchResults }
          );
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [messages, addMessage, addStatusMessage]);

  /**
   * Process the generator flow (which may loop back to searcher)
   */
  const processGeneratorFlow = async (
    userQuery: string,
    searchResults: SearchResult[]
  ) => {
    setCurrentAgent('generator');
    addStatusMessage('Analyzing search results and generating answer...', 'generator');

    const generatorContext: AgentContext = {
      userQuery,
      conversationHistory: messages,
      currentAgent: 'generator',
      searchResults,
    };

    if (!generatorRef.current) {
      throw new Error('Generator agent not initialized');
    }

    // Log generator request
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 GENERATOR REQUEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Query:', userQuery);
    console.log('Search Results:', searchResults.length);
    console.log('Iteration:', searchIterationRef.current);
    console.log('───────────────────────────────────────────────────────────');

    const generatorResponse = await generatorRef.current.generate(
      generatorContext,
      searchResults,
      searchIterationRef.current,
      searchTermsHistoryRef.current // Pass search history
    );

    // Log generator response
    console.log('📝 GENERATOR RESPONSE');
    console.log('───────────────────────────────────────────────────────────');
    console.log('Requires More Search:', generatorResponse.requiresMoreSearch || false);
    console.log('Is Complete:', generatorResponse.isComplete);
    console.log('Next Agent:', generatorResponse.nextAgent || 'none');
    console.log('Search Query:', generatorResponse.searchQuery || 'none');
    console.log('Status:', generatorResponse.statusMessage);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Check if generator needs more search
    if (generatorResponse.requiresMoreSearch && generatorResponse.nextAgent === 'searcher') {
      searchIterationRef.current++;
      
      // Only add status message if there's meaningful content (not empty, not JSON)
      if (generatorResponse.statusMessage && !generatorResponse.statusMessage.includes('{')) {
        addStatusMessage(generatorResponse.statusMessage, 'generator');
      }

      // Perform refined search
      setCurrentAgent('searcher');
      if (!searcherRef.current) {
        throw new Error('Searcher agent not initialized');
      }

      // Log additional search request
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🔍 ADDITIONAL SEARCH REQUEST (Iteration ${searchIterationRef.current})`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Original Query:', userQuery);
      console.log('Search Request:', generatorResponse.searchQuery || '');
      console.log('Previous Results Count:', currentSearchResultsRef.current.length);
      console.log(`Iteration: ${searchIterationRef.current} of 3`);
      console.log('───────────────────────────────────────────────────────────');

      // Add status message with iteration info
      addMessage(
        `Searching for more information (${searchIterationRef.current}/3)...`,
        'searcher',
        'search-status',
        { 
          searchIteration: searchIterationRef.current,
          maxSearchIterations: 3,
          searchQuery: generatorResponse.searchQuery 
        }
      );

      const newSearchTerm = generatorResponse.searchQuery || '';
      
      // Track this search term
      if (newSearchTerm && !searchTermsHistoryRef.current.includes(newSearchTerm)) {
        searchTermsHistoryRef.current.push(newSearchTerm);
        console.log(`📋 Search terms history: [${searchTermsHistoryRef.current.join(', ')}]`);
      }
      
      const additionalSearchResponse = await searcherRef.current.searchWithContext(
        newSearchTerm,
        currentSearchResultsRef.current
      );

      currentSearchResultsRef.current = additionalSearchResponse.searchResults || [];
      
      // Log additional search response
      console.log('🔍 ADDITIONAL SEARCH RESPONSE');
      console.log('───────────────────────────────────────────────────────────');
      console.log('Search Request:', generatorResponse.searchQuery || '');
      console.log('Total Results Now:', currentSearchResultsRef.current.length);
      console.log('Status:', additionalSearchResponse.statusMessage);
      console.log('═══════════════════════════════════════════════════════════\n');
      
      if (additionalSearchResponse.statusMessage) {
        addStatusMessage(additionalSearchResponse.statusMessage, 'searcher');
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

      // Log streaming start
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📝 GENERATOR STREAMING FINAL ANSWER');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Query:', userQuery);
      console.log('Using Results:', searchResults.length);
      console.log('───────────────────────────────────────────────────────────');

      let fullContent = '';
      let chunkCount = 0;
      for await (const chunk of generatorRef.current.streamAnswer(userQuery, searchResults)) {
        fullContent += chunk;
        chunkCount++;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullContent }
              : msg
          )
        );
      }

      // Log streaming complete
      console.log('📝 GENERATOR STREAMING COMPLETE');
      console.log('───────────────────────────────────────────────────────────');
      console.log('Total Chunks:', chunkCount);
      console.log('Total Characters:', fullContent.length);
      console.log('Final Answer Preview:', fullContent.substring(0, 200) + '...');
      console.log('═══════════════════════════════════════════════════════════\n');

      if (generatorResponse.statusMessage) {
        addStatusMessage('Answer complete', 'generator');
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
    searchTermsHistoryRef.current = []; // Clear search history
  }, []);

  return {
    messages,
    isProcessing,
    currentAgent,
    processUserMessage,
    resetConversation,
  };
};

