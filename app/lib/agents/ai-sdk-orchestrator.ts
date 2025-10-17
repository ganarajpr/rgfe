import { Experimental_Agent as Agent, stepCountIs, tool } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { searchTools, vectorSearchTool } from './ai-sdk-tools';
import { z } from 'zod';

/**
 * AI SDK Orchestrator Agent for RigVeda queries
 * This agent coordinates the entire workflow using the AI SDK Agent system
 */

// Tool for analyzing search results and determining next steps
const analyzeResultsTool = tool({
  description: 'Analyze search results and determine if more search is needed or if we can proceed to translation',
  inputSchema: z.object({
    userQuery: z.string().describe('The original user query'),
    searchResults: z.array(z.object({
      title: z.string(),
      content: z.string().optional(),
      relevance: z.number(),
      source: z.string().optional(),
      bookContext: z.string().optional(),
    })).describe('The search results to analyze'),
    iterationCount: z.number().describe('Current iteration count'),
    maxIterations: z.number().default(5).describe('Maximum allowed iterations'),
  }),
  execute: async ({ userQuery, searchResults, iterationCount, maxIterations }) => {
    console.log('📊 Analyze results tool called with:', { 
      userQuery, 
      resultCount: searchResults.length, 
      iterationCount, 
      maxIterations 
    });
    
    // Count relevant verses (assume all are relevant for now)
    const relevantVerseCount = searchResults.length;
    
    if (iterationCount >= maxIterations) {
      return {
        needsMoreSearch: false,
        reasoning: 'Maximum search iterations reached',
        relevantVerseCount,
        nextAction: 'proceed_to_translation',
      };
    }
    
    if (relevantVerseCount >= 5) {
      return {
        needsMoreSearch: false,
        reasoning: 'Maximum relevant verses reached (5)',
        relevantVerseCount,
        nextAction: 'proceed_to_translation',
      };
    }

    // Calculate average relevance score
    const avgScore = searchResults.length > 0 
      ? searchResults.reduce((sum, r) => sum + r.relevance, 0) / searchResults.length 
      : 0;

    // Determine if we need more search based on relevance scores
    // For cosine similarity, even 0.05 can be meaningful, so use a much lower threshold
    if (avgScore < 0.01) {
      return {
        needsMoreSearch: true,
        reasoning: `Very low relevance scores (avg: ${(avgScore * 100).toFixed(1)}%). Need better search terms.`,
        relevantVerseCount,
        nextAction: 'request_additional_search',
        suggestedSearchTerm: userQuery, // Could be enhanced with LLM-generated suggestions
      };
    }

    return {
      needsMoreSearch: false,
      reasoning: 'Sufficient relevant verses found',
      relevantVerseCount,
      nextAction: 'proceed_to_translation',
    };
  },
});

// Tool for translating and selecting final verses
const translateAndSelectTool = tool({
  description: 'Translate Sanskrit verses to English and select the most relevant ones for the final answer',
  inputSchema: z.object({
    userQuery: z.string().describe('The original user query'),
    searchResults: z.array(z.object({
      title: z.string(),
      content: z.string().optional(),
      relevance: z.number(),
      source: z.string().optional(),
      bookContext: z.string().optional(),
    })).describe('The search results to translate and select from'),
  }),
  execute: async ({ searchResults }) => {
    console.log('🔄 Translate and select tool called with:', { resultCount: searchResults.length });
    console.log('🔄 Search results details:', searchResults.map(r => ({ 
      title: r.title, 
      relevance: r.relevance, 
      hasContent: !!r.content 
    })));
    
    // For now, return all results with basic translations
    // In a full implementation, this would use an LLM to provide proper translations
    const translatedResults = searchResults.map(result => ({
      ...result,
      translation: result.content ? `Translation of: ${result.content.substring(0, 100)}...` : 'No translation available',
      importance: result.relevance > 0.05 ? 'high' : result.relevance > 0.03 ? 'medium' : 'low',
      isFiltered: result.relevance < 0.01, // Much lower threshold for cosine similarity
    }));

    return {
      selectedVerses: translatedResults.filter(r => !r.isFiltered),
      totalSelected: translatedResults.filter(r => !r.isFiltered).length,
      reasoning: 'Selected verses based on relevance scores',
    };
  },
});

// Tool for generating the final answer
const generateAnswerTool = tool({
  description: 'Generate a comprehensive final answer using the translated and selected verses',
  inputSchema: z.object({
    userQuery: z.string().describe('The original user query'),
    selectedVerses: z.array(z.object({
      title: z.string(),
      content: z.string().optional(),
      translation: z.string(),
      relevance: z.number(),
      source: z.string().optional(),
      bookContext: z.string().optional(),
      importance: z.enum(['high', 'medium', 'low']),
    })).describe('The selected and translated verses'),
  }),
  execute: async ({ userQuery, selectedVerses }) => {
    console.log('📝 Generate answer tool called with:', { 
      userQuery, 
      verseCount: selectedVerses.length 
    });
    
    // Generate a comprehensive answer using the verses
    if (selectedVerses.length === 0) {
      return {
        finalAnswer: `I apologize, but I was unable to find any relevant verses about "${userQuery}" in the RigVeda corpus. The search tools did not return any results that could be processed.`,
        verseCount: 0,
        success: false,
      };
    }

    const answer = `Based on the RigVeda verses found, here's what the ancient text reveals about "${userQuery}":

${selectedVerses.map((verse, index) => `
<verse>${verse.bookContext || verse.source || `${index + 1}`}</verse>
<sanskrit>${verse.content || 'Sanskrit text not available'}</sanskrit>
<translation>${verse.translation}</translation>
`).join('\n')}

These verses from the RigVeda provide insights into the topic you asked about, showing the ancient wisdom and perspectives contained in this sacred text.`;

    return {
      finalAnswer: answer,
      verseCount: selectedVerses.length,
      success: true,
    };
  },
});

/**
 * Create the main orchestrator agent
 */
export function createRigVedaOrchestrator(model: LanguageModelV2): Agent<any, any, any> {
  return new Agent({
    model,
    system: `You are a RigVeda research assistant that helps users find and understand verses from the ancient RigVeda text.

IMPORTANT: You MUST use the available tools to search for and analyze RigVeda verses. Do not provide generic responses without using the search tools.

Your workflow is:
1. ALWAYS start by using one of the search tools (vectorSearch, textSearch, bookContextSearch, or hybridSearch)
2. Use analyzeResults to evaluate the search results
3. If needed, use translateAndSelect to process the verses
4. Use generateAnswer to create the final response

Available search tools:
- vectorSearch: For conceptual/thematic queries (e.g., "hymns to Agni", "creation myths")
- textSearch: For specific Sanskrit words or deity names (e.g., "अग्नि", "Indra")
- bookContextSearch: For specific verse references in NUMERIC format ONLY (e.g., "1.1.1", "10.129", "7.50.2")
  CRITICAL: NEVER use "Mandala X Sukta Y" format. ALWAYS use numeric "X.Y.Z" format.
- hybridSearch: For complex queries needing both semantic and keyword matching

Available analysis tools:
- analyzeResults: Evaluate search results and determine if more search is needed
- translateAndSelect: Translate Sanskrit verses and select the most relevant ones
- generateAnswer: Generate a comprehensive final answer with proper formatting

CRITICAL RULES:
- ALWAYS use at least one search tool before providing any answer
- Use the proper <verse>X.Y.Z</verse>, <sanskrit>text</sanskrit>, and <translation>text</translation> tags
- Stop searching when you have up to 5 relevant verses
- Provide actual RigVeda content, not generic responses`,
    
    tools: {
      // Search tools
      ...searchTools,
      
      // Analysis and processing tools
      analyzeResults: analyzeResultsTool,
      translateAndSelect: translateAndSelectTool,
      generateAnswer: generateAnswerTool,
    },
    
    // Stop after reasonable number of steps to prevent infinite loops
    stopWhen: stepCountIs(20),
  });
}

/**
 * Enhanced function to process a user query with step-by-step feedback
 */
export async function processRigVedaQueryWithSteps(
  userQuery: string, 
  model: LanguageModelV2,
  onStepUpdate?: (step: { type: string; message: string; data?: any }) => void
): Promise<{
  finalAnswer: string;
  steps: any[];
  success: boolean;
  error?: string;
}> {
  try {
    const allSteps: any[] = [];
    
    // Step 1: Perform initial search
    onStepUpdate?.({ type: 'search', message: 'Performing vector search...' });
    
    if (!vectorSearchTool?.execute) {
      throw new Error('Vector search tool not available');
    }
    
    const searchResult = await vectorSearchTool.execute(
      { userQuery, searchSuggestion: undefined }, 
      { toolCallId: 'search-1', messages: [] }
    );
    
    allSteps.push({ tool: 'vectorSearch', result: searchResult });
    
    onStepUpdate?.({ 
      type: 'search_complete', 
      message: `Found ${(searchResult as any).count} verses`,
      data: { searchResult }
    });
    
    // Step 2: Analyze results
    onStepUpdate?.({ type: 'analysis', message: 'Analyzing search results...' });
    
    if (!analyzeResultsTool?.execute) {
      throw new Error('Analysis tool not available');
    }
    
    const analysisResult = await analyzeResultsTool.execute({
      userQuery,
      searchResults: (searchResult as any).results,
      iterationCount: 1,
      maxIterations: 3,
    }, { toolCallId: 'analyze-1', messages: [] });
    
    allSteps.push({ tool: 'analyzeResults', result: analysisResult });
    
    onStepUpdate?.({ 
      type: 'analysis_complete', 
      message: (analysisResult as any).reasoning || 'Analysis completed'
    });
    
    // Step 3: Translate and select
    if (!(analysisResult as any).needsMoreSearch) {
      onStepUpdate?.({ type: 'translation', message: 'Translating and selecting verses...' });
      
      if (!translateAndSelectTool?.execute) {
        throw new Error('Translation tool not available');
      }
      
      const translationResult = await translateAndSelectTool.execute({
        userQuery,
        searchResults: (searchResult as any).results,
      }, { toolCallId: 'translate-1', messages: [] });
      
      allSteps.push({ tool: 'translateAndSelect', result: translationResult });
      
      onStepUpdate?.({ 
        type: 'translation_complete', 
        message: `Selected ${(translationResult as any).totalSelected} relevant verses` 
      });
      
      // Step 4: Generate final answer
      onStepUpdate?.({ type: 'generation', message: 'Generating comprehensive answer...' });
      
      if (!generateAnswerTool?.execute) {
        throw new Error('Generation tool not available');
      }
      
      const generationResult = await generateAnswerTool.execute({
        userQuery,
        selectedVerses: (translationResult as any).selectedVerses,
      }, { toolCallId: 'generate-1', messages: [] });
      
      allSteps.push({ tool: 'generateAnswer', result: generationResult });
      
      onStepUpdate?.({ type: 'complete', message: 'Query completed successfully' });
      
      return {
        finalAnswer: (generationResult as any).finalAnswer,
        steps: allSteps,
        success: (generationResult as any).success,
      };
    } else {
      // Handle additional search if needed
      onStepUpdate?.({ type: 'additional_search', message: 'Performing additional search...' });
      
      // For now, just return the current results
      if (!translateAndSelectTool?.execute) {
        throw new Error('Translation tool not available');
      }
      
      const translationResult = await translateAndSelectTool.execute({
        userQuery,
        searchResults: (searchResult as any).results,
      }, { toolCallId: 'translate-1', messages: [] });
      
      allSteps.push({ tool: 'translateAndSelect', result: translationResult });
      
      if (!generateAnswerTool?.execute) {
        throw new Error('Generation tool not available');
      }
      
      const generationResult = await generateAnswerTool.execute({
        userQuery,
        selectedVerses: (translationResult as any).selectedVerses,
      }, { toolCallId: 'generate-1', messages: [] });
      
      allSteps.push({ tool: 'generateAnswer', result: generationResult });
      
      onStepUpdate?.({ type: 'complete', message: 'Query completed successfully' });
      
      return {
        finalAnswer: (generationResult as any).finalAnswer,
        steps: allSteps,
        success: (generationResult as any).success,
      };
    }
    
  } catch (error) {
    console.error('RigVeda query processing error:', error);
    onStepUpdate?.({ type: 'error', message: 'Error occurred during processing' });
    return {
      finalAnswer: 'I apologize, but I encountered an error processing your request. Please try again.',
      steps: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main function to process a user query using the AI SDK Agent system
 */
export async function processRigVedaQuery(
  userQuery: string, 
  model: LanguageModelV2
): Promise<{
  finalAnswer: string;
  steps: any[];
  success: boolean;
  error?: string;
}> {
  return processRigVedaQueryWithSteps(userQuery, model);
}
