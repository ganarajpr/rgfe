import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentContext, AgentResponse, SearchResult } from './types';

const ORCHESTRATOR_SYSTEM_PROMPT = `You are an Orchestrator Agent specializing in RigVeda queries. Your role is to:

1. CLASSIFY incoming user requests:
   - If the request is about the RigVeda (hymns, verses, deities, rituals, philosophy) → Route to SEARCHER agent
   - If the request is NOT about the RigVeda → Respond directly with a polite decline

2. COORDINATE between agents:
   - When receiving results from SEARCHER agent → Route to GENERATOR agent
   - When receiving final response from GENERATOR agent → Present to user

3. PROVIDE STATUS UPDATES:
   - Always inform the user what action you're taking
   - Keep messages concise and clear

IMPORTANT: This assistant ONLY answers questions about the RigVeda. Do NOT route queries about other Sanskrit texts (Upanishads, Mahabharata, Ramayana, Puranas, etc.) to the searcher.

Response format:
- For classification: Output JSON with { "isRigVedaRelated": boolean, "reasoning": string, "action": "respond" | "route_to_searcher" }
- For routing: Provide a brief status message about what's happening next
- For non-RigVeda queries: Politely explain you specialize in the RigVeda only

Current conversation context will be provided with each request.`;

export class OrchestratorAgent {
  private readonly model: LanguageModelV2;

  constructor(model: LanguageModelV2) {
    this.model = model;
  }

  /**
   * Process user query and determine routing
   */
  async processUserQuery(context: AgentContext): Promise<AgentResponse> {
    const userQuery = context.userQuery;

    // Create classification prompt
    const classificationPrompt = `${ORCHESTRATOR_SYSTEM_PROMPT}

<userRequest>
${userQuery}
</userRequest>

Analyze this request and determine if it relates to the RigVeda specifically (hymns, verses, deities, rituals, Vedic philosophy).
DO NOT classify questions about other Sanskrit texts (Upanishads, Mahabharata, Ramayana, Puranas, etc.) as RigVeda-related.
Output ONLY a JSON object with your classification decision.`;

    try {
      // Get classification from LLM
      const result = await streamText({
        model: this.model,
        prompt: classificationPrompt,
        temperature: 0.3,
      });

      let fullResponse = '';
      for await (const chunk of result.textStream) {
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
      const isRigVedaRelated = classification.isRigVedaRelated || classification.isSanskritRelated; // Support both field names
      if (isRigVedaRelated && classification.action === 'route_to_searcher') {
        return {
          content: `I understand you're asking about the RigVeda. Let me search for relevant information...`,
          nextAgent: 'searcher',
          isComplete: false,
          statusMessage: 'Searching the RigVeda for relevant verses and information...',
        };
      } else {
        // Not RigVeda related - respond directly
        return {
          content: `I appreciate your question, but I specialize exclusively in the RigVeda. Your question about "${userQuery}" appears to be outside my scope.

I can help you with:
- RigVeda hymns and verses (Suktas)
- Vedic deities (Agni, Indra, Soma, Varuna, etc.)
- Vedic rituals and ceremonies
- Vedic philosophy and cosmology
- Meters and poetic structure in the RigVeda
- Historical and cultural context of Vedic hymns

Is there anything related to the RigVeda I can help you with?`,
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

