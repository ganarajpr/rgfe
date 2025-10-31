import { LanguageModelV2 } from '@ai-sdk/provider';
import { SearcherAgent } from './searcher';
import { AnalyzerAgent } from './analyzer';
import { TranslatorAgent } from './translator';
import { GeneratorAgent } from './generator';
import { AgentResponse, SearchResult } from './types';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STRICT JSON SCHEMA DEFINITIONS FOR AGENT COMMUNICATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Each agent has clearly defined input and output schemas.
 * Agents communicate ONLY through these JSON structures.
 * No other form of communication is allowed.
 */

/**
 * Progress/Step callback interface for initialization and processing
 */
interface StepCallback {
  type: string;
  message: string;
  data?: {
    progress?: number;
    message?: string;
    [key: string]: unknown;
  };
}

/**
 * SEARCHER AGENT
 * Purpose: Find relevant verses in the RigVeda corpus
 * Input: User query + optional search suggestion from analyzer
 * Output: Search results with metadata
 */
interface SearcherInput {
  userQuery: string;           // The original user question
  searchSuggestion?: string;   // Optional suggestion from analyzer for refined search
}

interface SearcherOutput {
  success: boolean;            // Whether the search completed successfully
  searchResults: SearchResult[]; // Array of found verses
  searchType: string;          // Type of search performed (vector/text/hybrid/bookContext)
  searchTerm: string;          // The actual term used for searching
  error?: string;              // Error message if search failed
}

/**
 * ANALYZER AGENT
 * Purpose: Evaluate search results and determine if more search is needed
 * Input: User query + search results + iteration context
 * Output: Relevant verses + decision on whether more search is needed
 */
interface AnalyzerInput {
  userQuery: string;           // The original user question
  searchQuery: string;         // The search term/query that was used to find these results
  searchResults: SearchResult[]; // Verses to analyze (relevance scores should be ignored)
  iterationCount: number;      // Current iteration (0-4)
  previousSearchTerms: string[]; // Terms already searched to avoid repetition
}

interface AnalyzerOutput {
  success: boolean;            // Whether the analysis completed successfully
  relevantVerses: SearchResult[]; // Verses marked as relevant (not filtered)
  filteredVerses: SearchResult[]; // Verses marked as irrelevant
  needsMoreSearch: boolean;    // Whether more search iterations are needed
  searchSuggestion?: string;   // Sanskrit term to search next (if needsMoreSearch=true)
  error?: string;              // Error message if analysis failed
}

/**
 * TRANSLATOR AGENT
 * Purpose: Translate Sanskrit verses to English
 * Input: User query + verses to translate
 * Output: Translated verses
 */
interface TranslatorInput {
  userQuery: string;           // The original user question (for context)
  verses: SearchResult[];      // Verses to translate
}

interface TranslatorOutput {
  success: boolean;            // Whether the translation completed successfully
  translatedVerses: SearchResult[]; // Verses with translations added
  error?: string;              // Error message if translation failed
}

/**
 * GENERATOR AGENT
 * Purpose: Generate comprehensive answer from translated verses
 * Input: User query + translated verses
 * Output: Formatted answer text
 */
interface GeneratorInput {
  userQuery: string;           // The original user question
  translatedVerses: SearchResult[]; // Translated verses to use in answer
}

interface GeneratorOutput {
  success: boolean;            // Whether the generation completed successfully
  response: string;            // The generated answer text
  error?: string;              // Error message if generation failed
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AI SDK ORCHESTRATOR - Code-based Orchestration
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This orchestrator implements the architecture defined in agent.md.
 * All agent coordination is done in CODE, not through LLM function calling.
 * 
 * FLOW (as per agent.md):
 * 
 * 1. CHECK if query is about RigVeda
 *    - If not, return error message
 * 
 * 2. ITERATIVE SEARCH-ANALYZE LOOP (max 5 iterations):
 *    a. Call SEARCHER agent with (userQuery, suggestion)
 *       → Returns: search results
 *    
 *    b. Call ANALYZER agent with (userQuery, searchResults, iteration, previousTerms)
 *       → Returns: relevantVerses, filteredVerses, needsMoreSearch, searchSuggestion
 *    
 *    c. ACCUMULATE relevant verses in foundVerses array
 *    
 *    d. CHECK stopping conditions:
 *       - If totalVersesFound >= 5: BREAK and proceed to step 3
 *       - If analyzer says no more search needed: BREAK and proceed to step 3
 *       - If iteration >= 5: EXIT loop and proceed to step 3
 *    
 *    e. If needsMoreSearch: Use searchSuggestion for next iteration
 * 
 * 3. TRANSLATE found verses:
 *    - Call TRANSLATOR agent with (userQuery, foundVerses)
 *    → Returns: translated verses
 * 
 * 4. GENERATE final answer:
 *    - Call GENERATOR agent with (userQuery, translatedVerses)
 *    → Returns: formatted answer text
 * 
 * 5. RETURN final answer to user
 * 
 * ERROR HANDLING:
 * - Each agent call is wrapped in try-catch
 * - If agent returns success=false, log error and continue with fallback
 * - If no verses found after all iterations, return appropriate message
 */
export class AISDKOrchestrator {
  private readonly searcherAgent: SearcherAgent;
  private readonly analyzerAgent: AnalyzerAgent;
  private readonly translatorAgent: TranslatorAgent;
  private readonly generatorAgent: GeneratorAgent;
  private readonly maxIterations = 5;
  private readonly minVerses = 5;

  constructor(model: LanguageModelV2) {
    this.searcherAgent = new SearcherAgent(model);
    this.analyzerAgent = new AnalyzerAgent(model);
    this.translatorAgent = new TranslatorAgent(model);
    this.generatorAgent = new GeneratorAgent(model);
  }

  /**
   * Initialize the orchestrator and all agents
   * This must be called before processQuery
   */
  async initialize(progressCallback?: (step: StepCallback) => void): Promise<void> {
    console.log('🔧 Initializing AI SDK Orchestrator...');
    
    try {
      // Initialize the searcher agent's search tool
      await this.searcherAgent.initializeSearchTool((progress, message) => {
        if (progressCallback) {
          progressCallback({
            type: 'initialization',
            message: `Initializing: ${message} (${Math.round(progress * 100)}%)`,
            data: { progress, message }
          });
        }
      });
      
      console.log('✅ AI SDK Orchestrator fully initialized');
      
      if (progressCallback) {
        progressCallback({
          type: 'initialization_complete',
          message: 'System ready',
          data: { progress: 1 }
        });
      }
    } catch (error) {
      console.error('❌ Failed to initialize AI SDK Orchestrator:', error);
      throw new Error(`Orchestrator initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * VALIDATION FUNCTIONS
   * ═══════════════════════════════════════════════════════════════════════════
   * These functions validate that agents return proper JSON structures.
   * If validation fails, appropriate error responses are returned.
   */

  /**
   * Validate SearcherOutput structure
   */
  private validateSearcherOutput(output: unknown): SearcherOutput {
    if (!output || typeof output !== 'object') {
      console.error('❌ Invalid searcher output: not an object');
      return {
        success: false,
        searchResults: [],
        searchType: 'error',
        searchTerm: '',
        error: 'Invalid output structure from searcher'
      };
    }

    // Cast to record type for property access
    const obj = output as Record<string, unknown>;

    // Check required fields
    if (typeof obj.success !== 'boolean') {
      console.error('❌ Invalid searcher output: missing or invalid "success" field');
      obj.success = false;
    }

    if (!Array.isArray(obj.searchResults)) {
      console.error('❌ Invalid searcher output: "searchResults" is not an array');
      obj.searchResults = [];
    }

    if (typeof obj.searchType !== 'string') {
      console.warn('⚠️ Searcher output missing "searchType", defaulting to "unknown"');
      obj.searchType = 'unknown';
    }

    if (typeof obj.searchTerm !== 'string') {
      console.warn('⚠️ Searcher output missing "searchTerm", defaulting to empty string');
      obj.searchTerm = '';
    }

    return obj as unknown as SearcherOutput;
  }

  /**
   * Validate AnalyzerOutput structure
   */
  private validateAnalyzerOutput(output: unknown): AnalyzerOutput {
    if (!output || typeof output !== 'object') {
      console.error('❌ Invalid analyzer output: not an object');
      return {
        success: false,
        relevantVerses: [],
        filteredVerses: [],
        needsMoreSearch: false,
        error: 'Invalid output structure from analyzer'
      };
    }

    // Cast to record type for property access
    const obj = output as Record<string, unknown>;

    // Check required fields
    if (typeof obj.success !== 'boolean') {
      console.error('❌ Invalid analyzer output: missing or invalid "success" field');
      obj.success = false;
    }

    if (!Array.isArray(obj.relevantVerses)) {
      console.error('❌ Invalid analyzer output: "relevantVerses" is not an array');
      obj.relevantVerses = [];
    }

    if (!Array.isArray(obj.filteredVerses)) {
      console.error('❌ Invalid analyzer output: "filteredVerses" is not an array');
      obj.filteredVerses = [];
    }

    if (typeof obj.needsMoreSearch !== 'boolean') {
      console.warn('⚠️ Analyzer output missing "needsMoreSearch", defaulting to false');
      obj.needsMoreSearch = false;
    }

    return obj as unknown as AnalyzerOutput;
  }

  /**
   * Validate TranslatorOutput structure
   */
  private validateTranslatorOutput(output: unknown): TranslatorOutput {
    if (!output || typeof output !== 'object') {
      console.error('❌ Invalid translator output: not an object');
      return {
        success: false,
        translatedVerses: [],
        error: 'Invalid output structure from translator'
      };
    }

    // Cast to record type for property access
    const obj = output as Record<string, unknown>;

    // Check required fields
    if (typeof obj.success !== 'boolean') {
      console.error('❌ Invalid translator output: missing or invalid "success" field');
      obj.success = false;
    }

    if (!Array.isArray(obj.translatedVerses)) {
      console.error('❌ Invalid translator output: "translatedVerses" is not an array');
      obj.translatedVerses = [];
    }

    return obj as unknown as TranslatorOutput;
  }

  /**
   * Validate GeneratorOutput structure
   */
  private validateGeneratorOutput(output: unknown): GeneratorOutput {
    if (!output || typeof output !== 'object') {
      console.error('❌ Invalid generator output: not an object');
      return {
        success: false,
        response: '',
        error: 'Invalid output structure from generator'
      };
    }

    // Cast to record type for property access
    const obj = output as Record<string, unknown>;

    // Check required fields
    if (typeof obj.success !== 'boolean') {
      console.error('❌ Invalid generator output: missing or invalid "success" field');
      obj.success = false;
    }

    if (typeof obj.response !== 'string') {
      console.error('❌ Invalid generator output: "response" is not a string');
      obj.response = '';
    }

    return obj as unknown as GeneratorOutput;
  }

  /**
   * Main orchestration method - follows agent.md logic
   * 
   * @param userQuery - The user's question about the RigVeda
   * @param progressCallback - Optional callback for progress updates
   * @returns Result object with success status, steps, and final answer
   */
  async processQuery(
    userQuery: string,
    progressCallback?: (step: StepCallback) => void
  ): Promise<{
    success: boolean;
    steps: Array<{ tool: string; result: unknown }>;
    finalAnswer: string;
  }> {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎯 ORCHESTRATOR: Starting Query Processing');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`User Query: "${userQuery}"`);
    console.log('───────────────────────────────────────────────────────────\n');

    const steps: Array<{ tool: string; result: unknown }> = [];

    // Emit start message
    if (progressCallback) {
      progressCallback({
        type: 'agent_start',
        message: 'Starting query processing...',
      });
    }

    // Step 1: Check if query is about RigVeda
    const isAboutRigVeda = await this.checkIfAboutRigVeda(userQuery);
    if (!isAboutRigVeda) {
      console.log('❌ Query is not about RigVeda');
      const errorMessage = "Sorry, this question does not appear to be about the RigVeda. I can only answer questions related to the RigVeda corpus.";
      
      if (progressCallback) {
        progressCallback({
          type: 'error',
          message: 'Query is not about RigVeda',
        });
      }
      
      return {
        success: false,
        steps: [],
        finalAnswer: errorMessage,
      };
    }

    console.log('✅ Query is about RigVeda - proceeding with search\n');
    
    if (progressCallback) {
      progressCallback({
        type: 'notification',
        message: 'Query is about RigVeda - proceeding with search',
      });
    }

    // Step 2: Iterative search loop
    let currentIteration = 0;
    let totalVersesFound = 0;
    const allFoundVerses: SearchResult[] = [];
    const previousSearchTerms: string[] = [];
    let searchSuggestion: string | undefined = undefined;

    while (currentIteration < this.maxIterations) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 ITERATION ${currentIteration + 1}/${this.maxIterations}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Current relevant verses: ${totalVersesFound}`);
      console.log(`Target: ${this.minVerses} verses`);
      if (searchSuggestion) {
        console.log(`Search suggestion from analyzer: "${searchSuggestion}"`);
      }
      console.log('');

      // Emit loop iteration start message
      if (progressCallback) {
        progressCallback({
          type: 'loop_iteration',
          message: `🔄 Search-Analysis Loop: Iteration ${currentIteration + 1}/${this.maxIterations} (${totalVersesFound}/${this.minVerses} verses found)`,
          data: { 
            iteration: currentIteration + 1,
            maxIterations: this.maxIterations,
            versesFound: totalVersesFound,
            targetVerses: this.minVerses,
            searchSuggestion: searchSuggestion
          },
        });
      }

      // Step 2a: Call Searcher
      if (progressCallback) {
        progressCallback({
          type: 'search',
          message: searchSuggestion 
            ? `🔍 Searching with term: "${searchSuggestion}"`
            : `🔍 Searching for: "${userQuery}"`,
          data: { 
            iteration: currentIteration + 1,
            searchTerm: searchSuggestion || userQuery
          },
        });
      }

      const searcherOutput = await this.callSearcher({
        userQuery,
        searchSuggestion
      });

      steps.push({
        tool: 'vectorSearch',
        result: searcherOutput,
      });

      if (!searcherOutput.success || searcherOutput.searchResults.length === 0) {
        console.log(`⚠️ Iteration ${currentIteration + 1}: No results from searcher`);
        
        if (progressCallback) {
          progressCallback({
            type: 'search',
            message: `No results found in iteration ${currentIteration + 1}`,
          });
        }
        
        currentIteration++;
        continue;
      }

      console.log(`✅ Searcher found ${searcherOutput.searchResults.length} verses`);
      previousSearchTerms.push(searcherOutput.searchTerm);

      if (progressCallback) {
        progressCallback({
          type: 'search_complete',
          message: `Found ${searcherOutput.searchResults.length} verses`,
          data: {
            searchResult: {
              searchResults: searcherOutput.searchResults,
              searchType: searcherOutput.searchType,
              searchTerm: searcherOutput.searchTerm,
            },
          },
        });
      }

      // Step 2b: Call Analyzer
      if (progressCallback) {
        progressCallback({
          type: 'analysis',
          message: `Analyzing ${searcherOutput.searchResults.length} verses...`,
        });
      }

      const analyzerOutput = await this.callAnalyzer({
        userQuery,
        searchQuery: searcherOutput.searchTerm, // Pass the actual search query used
        searchResults: searcherOutput.searchResults,
        iterationCount: currentIteration,
        previousSearchTerms
      });

      steps.push({
        tool: 'analyze',
        result: analyzerOutput,
      });

      if (!analyzerOutput.success) {
        console.log(`⚠️ Iteration ${currentIteration + 1}: Analyzer failed`);
        
        if (progressCallback) {
          progressCallback({
            type: 'analysis',
            message: `Analysis failed in iteration ${currentIteration + 1}`,
          });
        }
        
        currentIteration++;
        continue;
      }

      if (progressCallback) {
        progressCallback({
          type: 'analysis_complete',
          message: `Analysis complete: ${analyzerOutput.relevantVerses.length} relevant verses found`,
          data: {
            needsMoreSearch: analyzerOutput.needsMoreSearch,
            relevantVerseCount: analyzerOutput.relevantVerses.length,
            searchSuggestion: analyzerOutput.searchSuggestion,
            relevantVerses: analyzerOutput.relevantVerses,
            filteredVerses: analyzerOutput.filteredVerses,
          },
        });
      }

      // Step 2c: Accumulate relevant verses
      if (analyzerOutput.relevantVerses.length > 0) {
        console.log(`✅ Analyzer found ${analyzerOutput.relevantVerses.length} relevant verses`);
        
        // Add new verses (avoid duplicates based on bookContext)
        const existingContexts = new Set(allFoundVerses.map(v => v.bookContext));
        const newVerses = analyzerOutput.relevantVerses.filter(
          v => !existingContexts.has(v.bookContext)
        );
        
        allFoundVerses.push(...newVerses);
        totalVersesFound = allFoundVerses.length;
        
        console.log(`📊 Total unique relevant verses accumulated: ${totalVersesFound}`);
        
        // Emit verse accumulation message
        if (progressCallback) {
          progressCallback({
            type: 'verses_accumulated',
            message: `📚 Accumulated ${newVerses.length} new verses (Total: ${totalVersesFound}/${this.minVerses})`,
            data: {
              newVerses: newVerses.length,
              totalVerses: totalVersesFound,
              targetVerses: this.minVerses,
            },
          });
        }
      } else {
        console.log(`⚠️ Analyzer found no relevant verses in this iteration`);
        
        if (progressCallback) {
          progressCallback({
            type: 'verses_accumulated',
            message: `⚠️ No relevant verses found in this iteration`,
            data: {
              newVerses: 0,
              totalVerses: totalVersesFound,
              targetVerses: this.minVerses,
            },
          });
        }
      }

      // Store suggestion for next iteration
      searchSuggestion = analyzerOutput.searchSuggestion;

      currentIteration++;

      // Step 2d: Check if we have enough verses
      if (totalVersesFound >= this.minVerses) {
        console.log(`\n✅ Target reached: ${totalVersesFound} >= ${this.minVerses} verses`);
        break;
      }

      // If analyzer says we don't need more search and we have some verses, stop
      if (!analyzerOutput.needsMoreSearch && totalVersesFound > 0) {
        console.log(`\n✅ Analyzer indicates sufficient information with ${totalVersesFound} verses`);
        break;
      }
    }

    // Step 3: Check if we found any verses
    if (totalVersesFound === 0) {
      console.log('\n❌ No relevant verses found after all iterations');
      const errorMessage = "Sorry, I could not find enough relevant information in the RigVeda to answer your question.";
      
      if (progressCallback) {
        progressCallback({
          type: 'error',
          message: 'No relevant verses found',
        });
      }
      
      return {
        success: false,
        steps,
        finalAnswer: errorMessage,
      };
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 FINAL RESULTS: ${totalVersesFound} relevant verses found`);
    console.log(`${'='.repeat(60)}\n`);

    if (progressCallback) {
      progressCallback({
        type: 'notification',
        message: `Found ${totalVersesFound} relevant verses - proceeding to translation`,
      });
    }

    // Step 4: Call Translator
    if (progressCallback) {
      progressCallback({
        type: 'translation',
        message: `Translating ${allFoundVerses.length} verses...`,
      });
    }

    const translatorOutput = await this.callTranslator({
      userQuery,
      verses: allFoundVerses
    });

    steps.push({
      tool: 'translate',
      result: translatorOutput,
    });

    if (!translatorOutput.success) {
      console.log('⚠️ Translation failed, proceeding with untranslated verses');
      
      if (progressCallback) {
        progressCallback({
          type: 'translation',
          message: 'Translation had some issues, proceeding with available translations',
        });
      }
    } else if (progressCallback) {
      progressCallback({
        type: 'translation_complete',
        message: `Translation complete: ${translatorOutput.translatedVerses.length} verses translated`,
        data: {
          selectedVerses: translatorOutput.translatedVerses.length,
        },
      });
    }

    const finalVerses = translatorOutput.success 
      ? translatorOutput.translatedVerses 
      : allFoundVerses;

    // Step 5: Call Generator - Use streaming to get full answer
    if (progressCallback) {
      progressCallback({
        type: 'generation',
        message: 'Generating comprehensive answer...',
      });
    }

    let finalAnswer = '';
    try {
      // Use streamAnswer to get the full generated response
      const abortController = new AbortController();
      for await (const chunk of this.generatorAgent.streamAnswer(
        userQuery,
        finalVerses,
        abortController.signal
      )) {
        finalAnswer += chunk;
        
        // Optionally emit streaming progress (but this might be too verbose)
        // For now, we'll just collect and return at the end
      }
    } catch (error) {
      console.error('❌ Generator streaming error:', error);
      finalAnswer = "Sorry, I encountered an error while generating the response.";
    }

    steps.push({
      tool: 'generate',
      result: { success: finalAnswer.length > 0, response: finalAnswer },
    });

    if (finalAnswer.length === 0) {
      finalAnswer = "Sorry, I encountered an error generating the response.";
      
      if (progressCallback) {
        progressCallback({
          type: 'error',
          message: 'Generator failed to produce response',
        });
      }
      
      return {
        success: false,
        steps,
        finalAnswer,
      };
    }

    console.log('\n✅ ORCHESTRATOR: Query processing complete\n');
    
    if (progressCallback) {
      progressCallback({
        type: 'complete',
        message: 'Query processing complete',
      });
    }

    return {
      success: true,
      steps,
      finalAnswer,
    };
  }

  /**
   * Check if the user query is about RigVeda
   */
  private async checkIfAboutRigVeda(userQuery: string): Promise<boolean> {
    try {
      // Simple heuristic check for RigVeda-related terms
      const lowerQuery = userQuery.toLowerCase();
      const rigVedaKeywords = [
        'rigveda', 'rig veda', 'veda', 'hymn', 'mantra', 'mandala',
        'agni', 'indra', 'soma', 'varuna', 'ushas', 'surya',
        'sacrifice', 'yajna', 'ritual', 'deity', 'god', 'goddess',
        'sanskrit', 'verse', 'sukta', 'nasadiya', 'purusha',
        'cosmic', 'creation', 'dharma', 'rita', 'brahman',
        '10.129', // Nasadiya Sukta reference
        '10.90',  // Purusha Sukta reference
      ];

      const hasKeyword = rigVedaKeywords.some(keyword => lowerQuery.includes(keyword));
      
      // If no obvious keywords, assume it's about RigVeda (generous interpretation)
      // We can make this stricter if needed
      return hasKeyword || lowerQuery.length > 0;
    } catch (error) {
      console.error('Error checking if query is about RigVeda:', error);
      return true; // Default to true on error
    }
  }

  /**
   * Call Searcher Agent with strict JSON schema
   * Validates output structure and handles errors
   */
  private async callSearcher(input: SearcherInput): Promise<SearcherOutput> {
    console.log('┌─ SEARCHER AGENT ─────────────────────────────────────────┐');
    console.log(`│ INPUT JSON:`);
    console.log(`│   userQuery: "${input.userQuery}"`);
    if (input.searchSuggestion) {
      console.log(`│   searchSuggestion: "${input.searchSuggestion}"`);
    }
    console.log('└──────────────────────────────────────────────────────────┘');

    try {
      const response: AgentResponse = await this.searcherAgent.vector_search(
        input.userQuery,
        input.searchSuggestion
      );

      const output: SearcherOutput = {
        success: true,
        searchResults: response.searchResults || [],
        searchType: 'vector',
        searchTerm: input.searchSuggestion || input.userQuery
      };

      // Validate output structure
      const validatedOutput = this.validateSearcherOutput(output);

      console.log(`│ OUTPUT JSON:`);
      console.log(`│   success: ${validatedOutput.success}`);
      console.log(`│   searchResults: ${validatedOutput.searchResults.length} verses`);
      console.log(`│   searchType: "${validatedOutput.searchType}"`);
      console.log(`│   searchTerm: "${validatedOutput.searchTerm}"`);
      if (validatedOutput.error) {
        console.log(`│   error: "${validatedOutput.error}"`);
      }
      console.log('└──────────────────────────────────────────────────────────┘\n');

      return validatedOutput;
    } catch (error) {
      console.error('❌ Searcher error:', error);
      const errorOutput = {
        success: false,
        searchResults: [],
        searchType: 'vector',
        searchTerm: input.userQuery,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      return this.validateSearcherOutput(errorOutput);
    }
  }

  /**
   * Call Analyzer Agent with strict JSON schema
   * Validates output structure and handles errors
   */
  private async callAnalyzer(input: AnalyzerInput): Promise<AnalyzerOutput> {
    console.log('┌─ ANALYZER AGENT ─────────────────────────────────────────┐');
    console.log(`│ INPUT JSON:`);
    console.log(`│   userQuery: "${input.userQuery}"`);
    console.log(`│   searchQuery: "${input.searchQuery}"`);
    console.log(`│   searchResults: ${input.searchResults.length} verses`);
    console.log(`│   iterationCount: ${input.iterationCount}`);
    console.log(`│   previousSearchTerms: [${input.previousSearchTerms.join(', ')}]`);
    console.log('└──────────────────────────────────────────────────────────┘');

    try {
      const response: AgentResponse = await this.analyzerAgent.analyze(
        input.userQuery,
        input.searchQuery,
        input.searchResults,
        input.iterationCount,
        input.previousSearchTerms
      );

      const relevantVerses = (response.searchResults || []).filter(v => !v.isFiltered);
      const filteredVerses = (response.searchResults || []).filter(v => v.isFiltered);

      const output: AnalyzerOutput = {
        success: true,
        relevantVerses,
        filteredVerses,
        needsMoreSearch: response.requiresMoreSearch || false,
        searchSuggestion: response.searchQuery
      };

      // Validate output structure
      const validatedOutput = this.validateAnalyzerOutput(output);

      console.log(`│ OUTPUT JSON:`);
      console.log(`│   success: ${validatedOutput.success}`);
      console.log(`│   relevantVerses: ${validatedOutput.relevantVerses.length} verses`);
      console.log(`│   filteredVerses: ${validatedOutput.filteredVerses.length} verses`);
      console.log(`│   needsMoreSearch: ${validatedOutput.needsMoreSearch}`);
      if (validatedOutput.searchSuggestion) {
        console.log(`│   searchSuggestion: "${validatedOutput.searchSuggestion}"`);
      }
      if (validatedOutput.error) {
        console.log(`│   error: "${validatedOutput.error}"`);
      }
      console.log('└──────────────────────────────────────────────────────────┘\n');

      return validatedOutput;
    } catch (error) {
      console.error('❌ Analyzer error:', error);
      const errorOutput = {
        success: false,
        relevantVerses: [],
        filteredVerses: [],
        needsMoreSearch: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      return this.validateAnalyzerOutput(errorOutput);
    }
  }

  /**
   * Call Translator Agent with strict JSON schema
   * Validates output structure and handles errors
   */
  private async callTranslator(input: TranslatorInput): Promise<TranslatorOutput> {
    console.log('┌─ TRANSLATOR AGENT ───────────────────────────────────────┐');
    console.log(`│ INPUT JSON:`);
    console.log(`│   userQuery: "${input.userQuery}"`);
    console.log(`│   verses: ${input.verses.length} verses`);
    console.log('└──────────────────────────────────────────────────────────┘');

    try {
      const response: AgentResponse = await this.translatorAgent.translateAndEvaluate(
        input.userQuery,
        input.verses
      );

      const output: TranslatorOutput = {
        success: true,
        translatedVerses: response.searchResults || input.verses
      };

      // Validate output structure
      const validatedOutput = this.validateTranslatorOutput(output);

      console.log(`│ OUTPUT JSON:`);
      console.log(`│   success: ${validatedOutput.success}`);
      console.log(`│   translatedVerses: ${validatedOutput.translatedVerses.length} verses`);
      if (validatedOutput.error) {
        console.log(`│   error: "${validatedOutput.error}"`);
      }
      console.log('└──────────────────────────────────────────────────────────┘\n');

      return validatedOutput;
    } catch (error) {
      console.error('❌ Translator error:', error);
      const errorOutput = {
        success: false,
        translatedVerses: input.verses,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      return this.validateTranslatorOutput(errorOutput);
    }
  }

  /**
   * Call Generator Agent with strict JSON schema
   * Validates output structure and handles errors
   */
  private async callGenerator(input: GeneratorInput): Promise<GeneratorOutput> {
    console.log('┌─ GENERATOR AGENT ────────────────────────────────────────┐');
    console.log(`│ INPUT JSON:`);
    console.log(`│   userQuery: "${input.userQuery}"`);
    console.log(`│   translatedVerses: ${input.translatedVerses.length} verses`);
    console.log('└──────────────────────────────────────────────────────────┘');

    try {
      const response: AgentResponse = await this.generatorAgent.generate(
        input.userQuery,
        input.translatedVerses
      );

      const output: GeneratorOutput = {
        success: true,
        response: response.content || 'No response generated'
      };

      // Validate output structure
      const validatedOutput = this.validateGeneratorOutput(output);

      console.log(`│ OUTPUT JSON:`);
      console.log(`│   success: ${validatedOutput.success}`);
      console.log(`│   response: ${validatedOutput.response.length} characters`);
      if (validatedOutput.error) {
        console.log(`│   error: "${validatedOutput.error}"`);
      }
      console.log('└──────────────────────────────────────────────────────────┘\n');

      return validatedOutput;
    } catch (error) {
      console.error('❌ Generator error:', error);
      const errorOutput = {
        success: false,
        response: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      return this.validateGeneratorOutput(errorOutput);
    }
  }
}
