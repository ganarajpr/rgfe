'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { OrchestratorAgent } from '../lib/agents/orchestrator';
import { SearcherAgent } from '../lib/agents/searcher';
import { AnalyzerAgent } from '../lib/agents/analyzer';
import { TranslatorAgent } from '../lib/agents/translator';
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
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Initialize agents with refs
  const orchestratorRef = useRef<OrchestratorAgent | null>(null);
  const searcherRef = useRef<SearcherAgent | null>(null);
  const analyzerRef = useRef<AnalyzerAgent | null>(null);
  const translatorRef = useRef<TranslatorAgent | null>(null);
  const generatorRef = useRef<GeneratorAgent | null>(null);

  const searchIterationRef = useRef<number>(0);
  const currentSearchResultsRef = useRef<SearchResult[]>([]);
  const searchTermsHistoryRef = useRef<string[]>([]); // Track search terms to avoid repeats
  const relevantVerseCountRef = useRef<number>(0); // Track relevant (non-filtered) verses

  /**
   * Remove any leading JSON or fenced ```json blocks from model output.
   * This prevents internal control JSON from flashing in the UI before the
   * actual natural language answer begins.
   */
  const sanitizeAssistantContent = useCallback((rawText: string): string => {
    if (!rawText) return rawText;

    let text = rawText;

    // Helper to drop a leading fenced code block (``` or ```json)
    const stripLeadingCodeFence = (input: string): string => {
      const trimmed = input.replace(/^\s+/, '');
      if (!trimmed.startsWith('```')) return input;

      // Find the first newline after opening fence
      const firstNewline = trimmed.indexOf('\n');
      const fenceHeader = firstNewline === -1 ? trimmed : trimmed.slice(0, firstNewline + 1);
      // Only treat as code fence if header is like ``` or ```json
      if (!/^```(json|javascript|js)?\s*\n$/i.test(fenceHeader)) return input;

      // Find the closing fence
      const closingIndex = trimmed.indexOf('\n```', fenceHeader.length);
      if (closingIndex === -1) return input; // No closing fence; leave as-is

      const afterFence = trimmed.slice(closingIndex + 4); // skip over "```"
      return afterFence.replace(/^\s+/, '');
    };

    // Try stripping a leading ```json fenced block if present
    text = stripLeadingCodeFence(text);

    // If the content still starts with a JSON object, try to remove the first object
    const startsWithObject = /^(\s*\{)/.test(text);
    if (startsWithObject) {
      // Attempt to find a valid JSON object at the start by progressively
      // expanding to the next closing brace and parsing.
      const maxScan = Math.min(text.length, 20000);
      let endIndex = -1;
      let attempts = 0;

      for (let i = 0; i < maxScan && attempts < 100; i++) {
        if (text[i] === '}') {
          attempts++;
          const candidate = text.slice(0, i + 1);
          try {
            const obj = JSON.parse(candidate);
            const keys = Object.keys(obj as Record<string, unknown>);
            const looksLikeControlJson = ['needsMoreSearch', 'searchRequest', 'reasoning', 'isRgvedaRelated', 'action'].some(k => keys.includes(k));
            if (looksLikeControlJson || keys.length > 0) {
              endIndex = i + 1;
              break;
            }
          } catch {
            // keep scanning
          }
        }
      }

      if (endIndex !== -1) {
        text = text.slice(endIndex).replace(/^\s+/, '');
      }
    }

    // Sanitize malformed Devanagari characters
    // Remove malformed Devanagari sequences (characters followed by question marks or garbled text)
    text = text.replace(/[\u0900-\u097F]+[?]+/g, ''); // Remove Devanagari followed by question marks
    text = text.replace(/[?]+[\u0900-\u097F]+/g, ''); // Remove question marks followed by Devanagari
    
    // Clean up multiple spaces and normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }, []);

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
      analyzerRef.current = new AnalyzerAgent(model);
      translatorRef.current = new TranslatorAgent(model);
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
    // Abort any previous run and create a new controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;
    // Check if agents are initialized
    if (!orchestratorRef.current || !searcherRef.current || !analyzerRef.current || !translatorRef.current || !generatorRef.current) {
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
    relevantVerseCountRef.current = 0; // Reset relevant verse count

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

      const orchestratorResponse = await orchestratorRef.current.processUserQuery(context, signal);

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

        const searchResponse = await searcherRef.current.search(searchContext, signal);
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

        // Add search results display message for initial search
        if (searchResponse.searchResults && searchResponse.searchResults.length > 0) {
          const avgRelevance = searchResponse.searchResults.reduce((sum, r) => sum + r.relevance, 0) / searchResponse.searchResults.length;
          const relevantCount = searchResponse.searchResults.filter(r => !r.isFiltered).length;
          const filteredCount = searchResponse.searchResults.filter(r => r.isFiltered).length;
          
          addMessage(
            `Found ${searchResponse.searchResults.length} verses from Sanskrit texts (${relevantCount} relevant, ${filteredCount} filtered).`,
            'searcher',
            'search-results',
            { 
              searchResults: searchResponse.searchResults,
              searchTerm: userQuery,
              searchIteration: 0,
              maxSearchIterations: 5,
              avgRelevanceScore: avgRelevance
            }
          );
        }

      // Step 3: Route to Analyzer
      await processAnalyzerFlow(userQuery, currentSearchResultsRef.current, signal);
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
   * Process the analyzer flow (which may loop back to searcher)
   */
  const processAnalyzerFlow = async (
    userQuery: string,
    searchResults: SearchResult[],
    signal: AbortSignal
  ) => {
    setCurrentAgent('analyzer');
    addStatusMessage('Analyzing search results...', 'analyzer');
    
    // Update relevant verse count
    relevantVerseCountRef.current = searchResults.filter(r => !r.isFiltered).length;

    if (!analyzerRef.current) {
      throw new Error('Analyzer agent not initialized');
    }

    // Log analyzer request
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 ANALYZER REQUEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Query:', userQuery);
    console.log('Search Results:', searchResults.length);
    console.log('Iteration:', searchIterationRef.current);
    console.log('───────────────────────────────────────────────────────────');

    const analyzerResponse = await analyzerRef.current.analyze(
      userQuery,
      searchResults,
      searchIterationRef.current,
      searchTermsHistoryRef.current
    );

    // Log analyzer response
    console.log('🔍 ANALYZER RESPONSE');
    console.log('───────────────────────────────────────────────────────────');
    console.log('Requires More Search:', analyzerResponse.requiresMoreSearch || false);
    console.log('Is Complete:', analyzerResponse.isComplete);
    console.log('Next Agent:', analyzerResponse.nextAgent || 'none');
    console.log('Search Query:', analyzerResponse.searchQuery || 'none');
    console.log('Status:', analyzerResponse.statusMessage);
    console.log('Relevant Verses:', relevantVerseCountRef.current);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Update search results with verse evaluations from analyzer
    if (analyzerResponse.searchResults) {
      currentSearchResultsRef.current = analyzerResponse.searchResults;
      relevantVerseCountRef.current = analyzerResponse.searchResults.filter(r => !r.isFiltered).length;
    }

    // Check if analyzer needs more search
    if (analyzerResponse.requiresMoreSearch && analyzerResponse.nextAgent === 'searcher') {
      searchIterationRef.current++;
      
      // Only add status message if there's meaningful content (not empty, not JSON)
      if (analyzerResponse.statusMessage && !analyzerResponse.statusMessage.includes('{')) {
        addStatusMessage(analyzerResponse.statusMessage, 'analyzer');
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
      console.log('Search Request:', analyzerResponse.searchQuery || '');
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
          searchQuery: analyzerResponse.searchQuery 
        }
      );

      const newSearchTerm = analyzerResponse.searchQuery || '';
      
      // Track this search term
      if (newSearchTerm && !searchTermsHistoryRef.current.includes(newSearchTerm)) {
        searchTermsHistoryRef.current.push(newSearchTerm);
        console.log(`📋 Search terms history: [${searchTermsHistoryRef.current.join(', ')}]`);
      }
      
      const additionalSearchResponse = await searcherRef.current.searchWithContext(
        newSearchTerm,
        currentSearchResultsRef.current,
        searchTermsHistoryRef.current
      );

      currentSearchResultsRef.current = additionalSearchResponse.searchResults || [];
      
      // Log additional search response
      console.log('🔍 ADDITIONAL SEARCH RESPONSE');
      console.log('───────────────────────────────────────────────────────────');
      console.log('Search Request:', analyzerResponse.searchQuery || '');
      console.log('Total Results Now:', currentSearchResultsRef.current.length);
      console.log('Status:', additionalSearchResponse.statusMessage);
      console.log('═══════════════════════════════════════════════════════════\n');
      
      if (additionalSearchResponse.statusMessage) {
        addStatusMessage(additionalSearchResponse.statusMessage, 'searcher');
      }

      // Add search results display message for additional search
      // Use only the new results for UI display, not the accumulated results
      const newResultsForDisplay = additionalSearchResponse.metadata?.newResults || [];
      if (newResultsForDisplay.length > 0) {
        const avgRelevance = newResultsForDisplay.reduce((sum, r) => sum + r.relevance, 0) / newResultsForDisplay.length;
        const relevantCount = newResultsForDisplay.filter(r => !r.isFiltered).length;
        const filteredCount = newResultsForDisplay.filter(r => r.isFiltered).length;
        
        addMessage(
          `Found ${newResultsForDisplay.length} additional verses from Sanskrit texts (${relevantCount} relevant, ${filteredCount} filtered).`,
          'searcher',
          'search-results',
          { 
            searchResults: newResultsForDisplay, // Display only new results
            searchTerm: newSearchTerm,
            searchIteration: searchIterationRef.current,
            maxSearchIterations: 5,
            avgRelevanceScore: avgRelevance
          }
        );
      }

      // Loop back to analyzer with new results
      await processAnalyzerFlow(userQuery, currentSearchResultsRef.current, signal);
      return;
    }

    // Analysis complete, proceed to translator
    if (analyzerResponse.isComplete) {
      await processTranslatorFlow(userQuery, searchResults, signal);
    }
  };

  /**
   * Process the translator flow (translate and select final verses)
   */
  const processTranslatorFlow = async (
    userQuery: string,
    searchResults: SearchResult[],
    signal: AbortSignal
  ) => {
    setCurrentAgent('translator');
    addStatusMessage('Translating and selecting final verses...', 'translator');

    if (!translatorRef.current) {
      throw new Error('Translator agent not initialized');
    }

    // Filter out already-processed verses (those with translations)
    // Only send new verses that haven't been translated yet
    const newVersesToTranslate = searchResults.filter(r => !r.translation);
    
    // If there are no new verses to translate, skip translation
    if (newVersesToTranslate.length === 0) {
      console.log('⏭️ No new verses to translate, proceeding to generator');
      await processGeneratorFlow(userQuery, currentSearchResultsRef.current, signal);
      return;
    }

    console.log(`🔄 Translator: Processing ${newVersesToTranslate.length} new verses (${searchResults.length - newVersesToTranslate.length} already processed)`);

    // Log translator request
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 TRANSLATOR REQUEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Query:', userQuery);
    console.log('Search Results:', searchResults.length);
    console.log('───────────────────────────────────────────────────────────');

    const translatorResponse = await translatorRef.current.translateAndEvaluate(
      userQuery,
      newVersesToTranslate,
      signal
    );

    // Log translator response
    console.log('🔄 TRANSLATOR RESPONSE');
    console.log('───────────────────────────────────────────────────────────');
    console.log('Is Complete:', translatorResponse.isComplete);
    console.log('Next Agent:', translatorResponse.nextAgent || 'none');
    console.log('Status:', translatorResponse.statusMessage);
    console.log('Selected Verses:', translatorResponse.searchResults?.filter(r => !r.isFiltered).length || 0);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Merge translator results back into the complete collection
    if (translatorResponse.searchResults) {
      // Create a map of updated verses from translator
      const updatedVersesMap = new Map(
        translatorResponse.searchResults.map(r => [r.id, r])
      );
      
      // Update the complete collection with translator results
      currentSearchResultsRef.current = currentSearchResultsRef.current.map(verse => {
        const updatedVerse = updatedVersesMap.get(verse.id);
        return updatedVerse || verse; // Use updated verse if available, otherwise keep original
      });
      
      console.log(`🔄 Translator: Updated ${translatorResponse.searchResults.length} verses in complete collection`);
    }

    if (translatorResponse.statusMessage) {
      addStatusMessage(translatorResponse.statusMessage, 'translator');
    }

    // Add translation results display message
    if (translatorResponse.searchResults && translatorResponse.searchResults.length > 0) {
      const selectedCount = translatorResponse.searchResults.filter(r => !r.isFiltered).length;
      const filteredCount = translatorResponse.searchResults.filter(r => r.isFiltered).length;
      
      addMessage(
        `Selected ${selectedCount} verses with translations for final answer (${filteredCount} filtered out).`,
        'translator',
        'search-results',
        { 
          searchResults: translatorResponse.searchResults,
          searchTerm: 'Translation and Selection',
          searchIteration: 0,
          maxSearchIterations: 1,
          avgRelevanceScore: 1.0
        }
      );
    }

    // Check if translator needs more search
    if (translatorResponse.requiresMoreSearch && translatorResponse.nextAgent === 'searcher') {
      searchIterationRef.current++;
      
      // Add status message
      if (translatorResponse.statusMessage) {
        addStatusMessage(translatorResponse.statusMessage, 'translator');
      }

      // Perform additional search
      setCurrentAgent('searcher');
      if (!searcherRef.current) {
        throw new Error('Searcher agent not initialized');
      }

      // Log additional search request from translator
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`🔍 TRANSLATOR REQUESTED ADDITIONAL SEARCH (Iteration ${searchIterationRef.current})`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('Original Query:', userQuery);
      console.log('Search Request:', translatorResponse.searchQuery || '');
      console.log('Previous Results Count:', currentSearchResultsRef.current.length);
      console.log(`Iteration: ${searchIterationRef.current} of 5`);
      console.log('───────────────────────────────────────────────────────────');

      // Add status message with iteration info
      addMessage(
        `Searching for more verses (${searchIterationRef.current}/5)...`,
        'searcher',
        'search-status',
        { 
          searchIteration: searchIterationRef.current,
          maxSearchIterations: 5,
          searchQuery: translatorResponse.searchQuery 
        }
      );

      const newSearchTerm = translatorResponse.searchQuery || '';
      
      // Track this search term
      if (newSearchTerm && !searchTermsHistoryRef.current.includes(newSearchTerm)) {
        searchTermsHistoryRef.current.push(newSearchTerm);
        console.log(`📋 Search terms history: [${searchTermsHistoryRef.current.join(', ')}]`);
      }
      
      const additionalSearchResponse = await searcherRef.current.searchWithContext(
        newSearchTerm,
        currentSearchResultsRef.current,
        searchTermsHistoryRef.current
      );

      currentSearchResultsRef.current = additionalSearchResponse.searchResults || [];
      
      // Log additional search response
      console.log('🔍 ADDITIONAL SEARCH RESPONSE');
      console.log('───────────────────────────────────────────────────────────');
      console.log('Search Request:', translatorResponse.searchQuery || '');
      console.log('Total Results Now:', currentSearchResultsRef.current.length);
      console.log('Status:', additionalSearchResponse.statusMessage);
      console.log('═══════════════════════════════════════════════════════════\n');
      
      if (additionalSearchResponse.statusMessage) {
        addStatusMessage(additionalSearchResponse.statusMessage, 'searcher');
      }

      // Add search results display message for additional search
      // Use only the new results for UI display, not the accumulated results
      const newResultsForDisplay = additionalSearchResponse.metadata?.newResults || [];
      if (newResultsForDisplay.length > 0) {
        const avgRelevance = newResultsForDisplay.reduce((sum, r) => sum + r.relevance, 0) / newResultsForDisplay.length;
        const relevantCount = newResultsForDisplay.filter(r => !r.isFiltered).length;
        const filteredCount = newResultsForDisplay.filter(r => r.isFiltered).length;
        
        addMessage(
          `Found ${newResultsForDisplay.length} additional verses from Sanskrit texts (${relevantCount} relevant, ${filteredCount} filtered).`,
          'searcher',
          'search-results',
          { 
            searchResults: newResultsForDisplay, // Display only new results
            searchTerm: newSearchTerm,
            searchIteration: searchIterationRef.current,
            maxSearchIterations: 5,
            avgRelevanceScore: avgRelevance
          }
        );
      }

      // Loop back to translator with ONLY new untranslated results
      const newVersesOnly = currentSearchResultsRef.current.filter(r => !r.translation);
      await processTranslatorFlow(userQuery, newVersesOnly, signal);
      return;
    }

    // Proceed to generator with translated and selected verses
    if (translatorResponse.isComplete) {
      await processGeneratorFlow(userQuery, currentSearchResultsRef.current, signal);
    }
  };

  /**
   * Process the generator flow (final answer generation)
   */
  const processGeneratorFlow = async (
    userQuery: string,
    searchResults: SearchResult[],
    signal: AbortSignal
  ) => {
    setCurrentAgent('generator');
    addStatusMessage('Generating comprehensive answer...', 'generator');

    if (!generatorRef.current) {
      throw new Error('Generator agent not initialized');
    }

    // Log generator request
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 GENERATOR REQUEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Query:', userQuery);
    console.log('Search Results:', searchResults.length);
    console.log('───────────────────────────────────────────────────────────');

    const generatorResponse = await generatorRef.current.generate();

    // Log generator response
    console.log('📝 GENERATOR RESPONSE');
    console.log('───────────────────────────────────────────────────────────');
    console.log('Is Complete:', generatorResponse.isComplete);
    console.log('Status:', generatorResponse.statusMessage);
    console.log('═══════════════════════════════════════════════════════════\n');

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
      for await (const chunk of generatorRef.current.streamAnswer(userQuery, searchResults, signal)) {
        if (signal.aborted) {
          break;
        }
        fullContent += chunk;
        // Clean any leading JSON/control output before updating UI
        fullContent = sanitizeAssistantContent(fullContent);
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
    relevantVerseCountRef.current = 0; // Reset relevant verse count
  }, []);

  return {
    messages,
    isProcessing,
    currentAgent,
    processUserMessage,
    resetConversation,
  };
};

