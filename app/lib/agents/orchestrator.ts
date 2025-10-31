import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentContext, AgentResponse, SearchResult } from './types';

const ORCHESTRATOR_SYSTEM_PROMPT = `You are an Orchestrator Agent specializing in Rgveda queries. Your role is to:

1. CLASSIFY incoming user requests:
   - If the request is about the Rgveda (hymns, verses, deities, rituals, philosophy) → Route to SEARCHER agent
   - If the request is NOT about the Rgveda → Respond directly with a polite decline

2. COORDINATE between agents:
   - When receiving results from SEARCHER agent → Route to ANALYZER agent
   - When receiving results from ANALYZER agent → Route to TRANSLATOR agent
   - When receiving results from TRANSLATOR agent → Route to GENERATOR agent
   - When receiving final response from GENERATOR agent → Present to user

3. PROVIDE STATUS UPDATES:
   - Always inform the user what action you're taking
   - Keep messages concise and clear

RIGVEDA KNOWLEDGE FOR CLASSIFICATION:
The Rgveda contains:
- 10 Mandalas (books) with 1,028 hymns (Suktas)
- Famous hymns include:
  * Nasadiya Sukta (10.129) - Creation hymn
  * Purusha Sukta (10.90) - Cosmic being
  * Gayatri Mantra (3.62.10) - Sacred verse
- Major deities: Agni, Indra, Soma, Varuna, Ushas, Surya, Mitra, etc.
- Key concepts: Rita (cosmic order), Yajna (sacrifice), Brahman, Atman
- Vedic rituals, ceremonies, cosmology, philosophy

IMPORTANT: 
- This assistant ONLY answers questions about the Rgveda
- DO route queries about Rgveda hymns (like Nasadiya Sukta, Purusha Sukta) to searcher
- DO NOT route queries about other texts (Upanishads, Mahabharata, Ramayana, Puranas, etc.)
- Be INCLUSIVE: if a query mentions Rgveda content, route it to searcher

Response format:
- For classification: Output JSON with { "isRgvedaRelated": boolean, "reasoning": string, "action": "respond" | "route_to_searcher" }
- For routing: Provide a brief status message about what's happening next
- For non-Rgveda queries: Politely explain you specialize in the Rgveda only

Current conversation context will be provided with each request.`;

export class OrchestratorAgent {
  private readonly model: LanguageModelV2;

  constructor(model: LanguageModelV2) {
    this.model = model;
  }

  /**
   * Process user query and determine routing
   */
  async processUserQuery(context: AgentContext, signal?: AbortSignal): Promise<AgentResponse> {
    const userQuery = context.userQuery;

    // Create classification prompt
    const classificationPrompt = `${ORCHESTRATOR_SYSTEM_PROMPT}

<userRequest>
${userQuery}
</userRequest>

Analyze this request and determine if it relates to the Rgveda specifically.

CLASSIFY AS RIGVEDA-RELATED IF:
- Asks about Rgveda hymns (Suktas) like Nasadiya Sukta, Purusha Sukta, etc.
- Asks about Vedic deities (Agni, Indra, Soma, Varuna, Ushas, etc.)
- Asks about Vedic concepts (Rita, Yajna, sacrifice, cosmic order, etc.)
- Asks about Rgveda Mandalas, verses, or structure
- Asks about Vedic rituals, ceremonies, or philosophy FROM THE RIGVEDA
- Mentions specific Rgveda references (e.g., "10.129", "Mandala 10")

CLASSIFY AS NOT RIGVEDA-RELATED IF:
- Explicitly asks about other texts: Upanishads, Mahabharata, Ramayana, Puranas, Bhagavad Gita
- Asks about later Vedas: Sama Veda, Yajur Veda, Atharva Veda (unless comparing to Rgveda)
- Asks about non-Vedic topics

BE INCLUSIVE: When in doubt, route to searcher. The searcher can handle queries even if they're not perfect.

Output ONLY a JSON object with your classification decision.`;

    try {
      // Get classification from LLM
      const result = streamText({
        model: this.model,
        prompt: classificationPrompt,
        temperature: 0.3,
        abortSignal: signal,
      });

      let fullResponse = '';
      for await (const chunk of result.textStream) {
        if (signal?.aborted) {
          break;
        }
        fullResponse += chunk;
      }

      // Try to parse JSON response
      let classification;
      try {
        // Extract JSON from response (in case there's extra text)
        const jsonRegex = /\{[\s\S]*\}/;
        const jsonMatch = jsonRegex.exec(fullResponse);
        if (jsonMatch) {
          classification = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: assume it's not Sanskrit related if we can't parse
          classification = { isSanskritRelated: false, reasoning: 'Could not parse response', action: 'respond' };
        }
      } catch {
        // Fallback
        classification = { isSanskritRelated: false, reasoning: 'Could not parse response', action: 'respond' };
      }

      // Route based on classification
      const isRgvedaRelated = classification.isRgvedaRelated || classification.isSanskritRelated; // Support both field names
      if (isRgvedaRelated && classification.action === 'route_to_searcher') {
        return {
          content: `I understand you're asking about the Rgveda. Let me search for relevant information...`,
          nextAgent: 'searcher',
          isComplete: false,
          statusMessage: 'Searching the Rgveda for relevant verses and information...',
        };
      } else {
        // Not Rgveda related - respond directly
        return {
          content: `I appreciate your question, but I specialize exclusively in the Rgveda. Your question about "${userQuery}" appears to be outside my scope.

I can help you with:
- Rgveda hymns and verses (Suktas)
- Vedic deities (Agni, Indra, Soma, Varuna, etc.)
- Vedic rituals and ceremonies
- Vedic philosophy and cosmology
- Meters and poetic structure in the Rgveda
- Historical and cultural context of Vedic hymns

Is there anything related to the Rgveda I can help you with?`,
          isComplete: true,
          statusMessage: 'Response complete',
        };
      }
    } catch (error) {
      console.error('Orchestrator error:', error);
      return {
        content: 'I encountered an error processing your request. Please try again.',
        isComplete: true,
      };
    }
  }

  /**
   * Process search results from Searcher agent and route to Generator
   */
  async processSearchResults(context: AgentContext): Promise<AgentResponse> {
    const searchResults = context.searchResults || [];
    
    if (searchResults.length === 0) {
      return {
        content: `I couldn't find relevant information in my knowledge base. Could you rephrase your question or provide more context?`,
        isComplete: true,
        statusMessage: '❌ No results found',
      };
    }

    // Create verses display content
    const versesContent = this.formatVersesForDisplay(searchResults);

    return {
      content: versesContent,
      nextAgent: 'generator',
      isComplete: false,
      statusMessage: 'Generating comprehensive answer...',
      searchResults,
    };
  }

  /**
   * Format search results as verses for display
   */
  private formatVersesForDisplay(searchResults: SearchResult[]): string {
    if (searchResults.length === 0) {
      return 'No verses found.';
    }

    const versesList = searchResults.map((result) => {
      const relevance = (result.relevance * 100).toFixed(1);
      const source = result.source || 'Sanskrit Text';
      const verseRef = result.bookContext || 'Verse';
      const content = result.content || result.title || 'No content available';
      
      return `**${verseRef}** (Relevance: ${relevance}%)
*Source: ${source}*

${content}

---`;
    }).join('\n\n');

    return `**Found ${searchResults.length} relevant verses:**

${versesList}

*Analyzing these verses to provide a comprehensive answer...*`;
  }

  /**
   * Process final response from Generator agent
   */
  async processFinalResponse(context: AgentContext, generatedContent: string): Promise<AgentResponse> {
    return {
      content: generatedContent,
      isComplete: true,
      statusMessage: 'Answer complete',
    };
  }

  /**
   * Process translation results from Translator agent and route to Generator
   */
  async processTranslationResults(context: AgentContext): Promise<AgentResponse> {
    const searchResults = context.searchResults || [];
    
    if (searchResults.length === 0) {
      return {
        content: `No verses were selected for translation. Please try rephrasing your question.`,
        isComplete: true,
        statusMessage: '❌ No verses selected',
      };
    }

    // Count selected verses (non-filtered)
    const selectedVerses = searchResults.filter(r => !r.isFiltered);

    return {
      content: `Selected ${selectedVerses.length} relevant verses with translations for comprehensive answer.`,
      nextAgent: 'generator',
      isComplete: false,
      statusMessage: `Ready to generate answer with ${selectedVerses.length} translated verses`,
      searchResults,
    };
  }

  /**
   * Handle request for additional search from Generator
   */
  async handleAdditionalSearchRequest(searchQuery: string): Promise<AgentResponse> {
    return {
      content: `Refining search with additional context...`,
      nextAgent: 'searcher',
      isComplete: false,
      statusMessage: `Searching with refined query: "${searchQuery}"...`,
      searchQuery,
    };
  }
}

