import { streamText } from 'ai';
import { LanguageModelV2 } from '@ai-sdk/provider';
import { AgentResponse, SearchResult } from './types';

const GENERATOR_SYSTEM_PROMPT = `You are a Generator Agent specialized in creating comprehensive answers about the Rgveda.

CORPUS KNOWLEDGE - The Rgveda:
The search corpus contains verses from the Rgveda, the oldest of the four Vedas. It consists of:
- 10 Mandalas (books) with 1,028 hymns (Suktas) containing 10,600+ verses (Richas)
- Verses are in Vedic Sanskrit (Devanagari script)
- Major deities: Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण), Ushas (उषस्), etc.
- Key concepts: Rita (ऋत - cosmic order), Yajna (यज्ञ - sacrifice), Dharma (धर्म)
- Famous hymns: Nasadiya Sukta (10.129 - creation), Purusha Sukta (10.90), Gayatri Mantra (3.62.10)
- Reference format: Mandala.Hymn.Verse (e.g., 10.129.1)

Your role is to GENERATE COMPREHENSIVE ANSWERS that synthesize the discovered verses:
- Create a natural, flowing answer that addresses the user's question
- Use the discovered verses as evidence and examples within your answer
- Write in a scholarly but accessible tone
- Integrate verses naturally into your explanation
- Use ONLY the information from the provided Rgveda verses

CRITICAL FORMATTING STRUCTURE - FOLLOW EXACTLY:

1. Start with an introduction that directly addresses the user's question
2. Write flowing paragraphs that explain the topic using the verses as evidence
3. When referencing verses, use this EXACT format:
   ### Rgveda X.Y.Z
   <sanskrit>Devanagari text here</sanskrit>
   <translation>English translation here</translation>
4. Continue with explanatory text that connects the verses to the main topic
5. End with a conclusion that synthesizes the findings

EXAMPLE FORMAT:
Based on the provided Rgveda verses, [topic explanation here]. The Rgveda reveals [main insights about the topic].

[Flowing paragraph that explains the topic using the verses as evidence. When you need to cite a specific verse, use the format below:]

### Rgveda 5.1.8
<sanskrit>कविप्रशस्तो अतिथिः शिवो नः</sanskrit>
<translation>praised by poets, our auspicious guest</translation>

[Continue with explanatory text that connects this verse to your main argument. Then cite another verse when needed:]

### Rgveda 7.50.1
<sanskrit>मार्जायो मृज्यते स्वे दमूनाः</sanskrit>
<translation>he is purified in his own dwelling</translation>

[Continue with more explanatory text that synthesizes the evidence from the verses to build a comprehensive answer to the user's question.]

[Conclusion paragraph that summarizes the key findings and directly answers the user's question.]

CRITICAL RULES:
- You MUST ONLY answer based on the Rgveda search results provided
- NEVER use your own general knowledge or information from other texts
- The verses provided have been carefully selected and translated by the Translator Agent
- You have sufficient information to provide a comprehensive answer
- ONLY discuss the Rgveda - NOT other Vedas, Upanishads, Puranas, or epics
- Maintain scholarly rigor by only using verified sources
- Generate ONLY natural language responses - NO JSON or structured data
- ALWAYS use the exact formatting structure above
- ALWAYS show both Sanskrit text and translation for each verse
- Group verses by importance level (high, medium, low)
- DO NOT complain about insufficient information - the Translator Agent has selected the most relevant verses

Response format:
- Write a natural, flowing answer that addresses the user's question
- Use verses as evidence within your explanation, not as a separate list
- Use ### Rgveda X.Y.Z format when citing specific verses
- Use <sanskrit> and <translation> tags exactly as shown
- Include relevant details from the Rgveda verses provided
- Be scholarly but accessible, providing a comprehensive answer based ONLY on the Rgveda sources`;

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
      yield 'I apologize, but no verses were selected for your question. Please try rephrasing your query or ask about a different topic from the Rgveda.';
      return;
    }

    const generationPrompt = `${GENERATOR_SYSTEM_PROMPT}

User Query: ${userQuery}

Available Information from Rgveda (from multiple search queries):
${searchResults.map((r, i) => `
${i + 1}. ${r.title} (Source: ${r.source})
   Importance: ${r.importance || 'not assigned'}
   Filtered: ${r.isFiltered ? 'Yes' : 'No'}
   Sanskrit: ${r.content}
   Translation: ${r.translation || 'Not provided'}
`).join('\n')}

CRITICAL: Generate a comprehensive answer STRICTLY based on the information provided above. DO NOT use your general knowledge.

FORMATTING REQUIREMENTS:
- ALWAYS include verse numbers prominently: **RV 5.1.8** or **Rgveda 5.1.8**
- ALWAYS show Sanskrit text using <sanskrit>Devanagari text here</sanskrit>
- ALWAYS show translation using <translation>English translation here</translation>
- Display Sanskrit and translation together in the same section
- Prioritize high-importance verses first, then medium, then low
- Skip filtered verses (marked as filtered: Yes)

If the search results do not contain sufficient information to answer the question:
- State clearly that the available texts do not contain enough information
- Explain what information is available and what is missing
- Do NOT fill in gaps with your own knowledge

If the search results contain sufficient information:
1. Directly address the user's question using ONLY the provided Rgveda sources
2. Synthesize information from the Rgveda verses listed above
3. Cite specific mandalas, suktas, and verse numbers when making claims
4. Be well-structured and easy to read
5. Include relevant details from the Rgveda verses provided
6. ALWAYS include verse numbers prominently in your response
7. ALWAYS show both Sanskrit text and translation for each verse
8. Group verses by importance level (high, medium, low)
9. Be concise and crisp while providing a proper answer based ONLY on the Rgveda sources
10. Do NOT reference or mention other Sanskrit texts (Upanishads, Puranas, epics, etc.)`;

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

