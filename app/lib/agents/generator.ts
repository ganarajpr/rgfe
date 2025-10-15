import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentResponse, SearchResult } from './types';

const GENERATOR_SYSTEM_PROMPT = `You are a Generator Agent specialized in creating comprehensive answers about the RigVeda.

CORPUS KNOWLEDGE - The RigVeda:
The search corpus contains verses from the RigVeda, the oldest of the four Vedas. It consists of:
- 10 Mandalas (books) with 1,028 hymns (Suktas) containing 10,600+ verses (Richas)
- Verses are in Vedic Sanskrit (Devanagari script)
- Major deities: Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण), Ushas (उषस्), etc.
- Key concepts: Rita (ऋत - cosmic order), Yajna (यज्ञ - sacrifice), Dharma (धर्म)
- Famous hymns: Nasadiya Sukta (10.129 - creation), Purusha Sukta (10.90), Gayatri Mantra (3.62.10)
- Reference format: Mandala.Hymn.Verse (e.g., 10.129.1)

Your role is to GENERATE COMPREHENSIVE ANSWERS:
- Synthesize ALL search results gathered across all iterations
- Generate a comprehensive, well-structured answer
- Include verse citations with Mandala.Hymn.Verse references
- Highlight important sections vs. supporting details
- Use ONLY the information from the provided RigVeda verses

CRITICAL RULES:
- You MUST ONLY answer based on the RigVeda search results provided
- NEVER use your own general knowledge or information from other texts
- If results are insufficient, state that clearly
- ONLY discuss the RigVeda - NOT other Vedas, Upanishads, Puranas, or epics
- Maintain scholarly rigor by only using verified sources
- Generate ONLY natural language responses - NO JSON or structured data

Response format:
- Comprehensive markdown response with citations and proper structure
- Use **bold** for Sanskrit verses and *italics* for translations
- Include relevant details from the RigVeda verses provided
- Be concise and crisp while providing a proper answer based ONLY on the RigVeda sources`;

export class GeneratorAgent {
  private readonly model: LanguageModelV2;

  constructor(model: LanguageModelV2) {
    this.model = model;
  }

  /**
   * Generate final answer based on search results
   * Analysis is now handled by AnalyzerAgent
   */
  async generate(): Promise<AgentResponse> {
    // Generate final answer
    return await this.generateFinalAnswer();
  }


  /**
   * Generate the final comprehensive answer
   */
  private async generateFinalAnswer(): Promise<AgentResponse> {
    // Note: This method prepares the response but doesn't actually generate it.
    // The actual streaming happens in streamAnswer method.
    return {
      content: '', // Will be populated by streaming in streamAnswer
      isComplete: true,
      statusMessage: 'Generating answer...',
    };
  }

  /**
   * Stream the generated answer
   */
  async *streamAnswer(
    userQuery: string,
    searchResults: SearchResult[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    // If no search results, return early with explanation
    if (!searchResults || searchResults.length === 0) {
      yield 'I apologize, but I could not find any relevant verses in the RigVeda to answer your question. Please try rephrasing your query or ask about a different topic from the RigVeda.';
      return;
    }

    const generationPrompt = `${GENERATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Information from RigVeda (from multiple search queries):
${searchResults.map((r, i) => `
${i + 1}. ${r.title} (Source: ${r.source})
   ${r.content}
`).join('\n')}

CRITICAL: Generate a comprehensive answer STRICTLY based on the information provided above. DO NOT use your general knowledge.

If the search results do not contain sufficient information to answer the question:
- State clearly that the available texts do not contain enough information
- Explain what information is available and what is missing
- Do NOT fill in gaps with your own knowledge

If the search results contain sufficient information:
1. Directly address the user's question using ONLY the provided RigVeda sources
2. Synthesize information from the RigVeda verses listed above
3. Cite specific mandalas, suktas, and verse numbers when making claims
4. Be well-structured and easy to read
5. Include relevant details from the RigVeda verses provided
6. Highlight verses and translations appropriately using markdown formatting
7. Use **bold** for Sanskrit verses and *italics* for translations
8. Be concise and crisp while providing a proper answer based ONLY on the RigVeda sources
9. Do NOT reference or mention other Sanskrit texts (Upanishads, Puranas, epics, etc.)`;

    try {
      const result = streamText({
        model: this.model,
        prompt: generationPrompt,
        temperature: 0.6,
        abortSignal: signal,
      });

      for await (const chunk of result.textStream) {
        if (signal?.aborted) {
          break;
        }
        yield chunk;
      }
    } catch (error) {
      console.error('❌ Generator streaming error:', error);
      yield 'I apologize, but I encountered an error while generating your answer.';
    }
  }
}

