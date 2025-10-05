import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentContext, AgentResponse } from './types';

const ORCHESTRATOR_SYSTEM_PROMPT = `You are an Orchestrator Agent specializing in Sanskrit literature queries. Your role is to:

1. CLASSIFY incoming user requests:
   - If the request is about Sanskrit literature, philosophy, texts, or related topics → Route to SEARCHER agent
   - If the request is NOT about Sanskrit literature → Respond directly with a polite decline

2. COORDINATE between agents:
   - When receiving results from SEARCHER agent → Route to GENERATOR agent
   - When receiving final response from GENERATOR agent → Present to user

3. PROVIDE STATUS UPDATES:
   - Always inform the user what action you're taking
   - Keep messages concise and clear

Response format:
- For classification: Output JSON with { "isSanskritRelated": boolean, "reasoning": string, "action": "respond" | "route_to_searcher" }
- For routing: Provide a brief status message about what's happening next
- For non-Sanskrit queries: Politely explain you specialize in Sanskrit literature

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

Analyze this request and determine if it relates to Sanskrit literature, texts, philosophy, or related topics.
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
      if (classification.isSanskritRelated && classification.action === 'route_to_searcher') {
        return {
          content: `I understand you're asking about Sanskrit literature. Let me search for relevant information...`,
          nextAgent: 'searcher',
          isComplete: false,
          statusMessage: 'Searching for relevant Sanskrit texts and information...',
        };
      } else {
        // Not Sanskrit related - respond directly
        return {
          content: `I appreciate your question, but I specialize in Sanskrit literature and related topics. Your question about "${userQuery}" appears to be outside my area of expertise. 

I can help you with:
- Sanskrit texts (Vedas, Upanishads, Puranas, epics like Mahabharata and Ramayana)
- Sanskrit philosophy and schools of thought
- Classical Sanskrit literature and poetry
- Sanskrit grammar and linguistics
- Historical and cultural aspects of Sanskrit traditions

Is there anything related to Sanskrit literature I can help you with?`,
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

    return {
      content: `Found ${searchResults.length} relevant sources. Now analyzing and generating your answer...`,
      nextAgent: 'generator',
      isComplete: false,
      statusMessage: 'Generating comprehensive answer...',
    };
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

