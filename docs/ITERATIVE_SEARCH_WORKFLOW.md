# Iterative Search Workflow with Generative UI

## Overview

The RigVeda Assistant now implements an intelligent iterative search workflow where the system can refine its search up to 3 times to gather sufficient information before generating the final answer. This replaces the previous approach of running 3 parallel searches upfront.

## Architecture

### Workflow Flow

```
User Query
    ↓
Orchestrator (Classification)
    ↓
Searcher (Initial Search)
    ↓
Generator (Evaluation) ←─┐
    ↓                     │
    ├─→ Sufficient? → Generate Final Answer
    │                     │
    └─→ Insufficient? → Request More Search (max 3 loops)
```

### Key Components

1. **OrchestratorAgent**: Routes queries and manages overall flow
2. **SearcherAgent**: Performs focused single-term searches
3. **GeneratorAgent**: Evaluates sufficiency and generates answers
4. **Generative UI Components**: Interactive citation and verse display

## Iterative Loop Process

### Step 1: Initial Search
The Orchestrator delegates the user's query to the Searcher, which:
- Generates ONE focused Sanskrit search term based on the query
- Uses **RigVeda corpus knowledge** to create contextually appropriate terms
- Performs semantic vector search in the RigVeda corpus
- Returns up to 10 relevant verses with similarity scores

### Step 2: Intelligent Evaluation Loop (Max 3 Iterations)
The Generator analyzes the accumulated search results **with score-aware intelligence**:

#### Score-Based Analysis:
- **LOW SCORES (<0.3)**: Results likely poor match
  - Makes **knowledgeable guesses** for better RigVeda-specific terms
  - Example: "Nasadiya Sukta" → tries "नासदीय" or "सृष्टि सूक्त" or "मण्डल १०"
  - Uses RigVeda expertise: deities, hymn names, Sanskrit concepts
  
- **MEDIUM SCORES (0.3-0.6)**: Results relevant but improvable
  - Requests specific missing aspects or details
  - Refines based on content gaps
  
- **HIGH SCORES (>0.6)**: Strong match
  - Checks if content sufficiently answers the question
  - May still request additional specific information if gaps exist

#### Decision Flow:
- **If Sufficient**: Proceeds to generate the final answer
- **If Insufficient & within loop limit**: Requests additional search with intelligent Sanskrit term
- **Loop Counter**: Tracks iterations (0, 1, 2, 3)
- **Max Limit**: Stops after 3 additional searches

### Step 3: Final Generation
Once information gathering is complete (sufficient or max iterations reached):
- Compiles all gathered verses across all searches
- Generates comprehensive answer using ONLY the search results
- Returns structured response with citations
- If still insufficient after max iterations, clearly states limitations

## Generative UI Features

### Collapsible Citation Verses

Each verse is displayed as an interactive, collapsible component:

```typescript
<CitationVerse 
  verse={searchResult}
  importance="high" | "medium" | "low"
/>
```

**Features:**
- Click to expand/collapse full content
- Relevance score indicator
- Source attribution
- Color-coded importance levels
- Progress bar visualization

**Importance Levels:**
- 🔵 **High**: Critical verses (blue highlight)
- ⚪ **Medium**: Supporting verses (gray)
- ⚪ **Low**: Contextual verses (light gray)

### Highlighted Answers

The final answer uses importance-based highlighting:

```typescript
<HighlightedAnswer
  content={answerText}
  highlightSections={[
    { start: 0, end: 100, importance: 'high' },
    { start: 100, end: 200, importance: 'medium' }
  ]}
/>
```

**Visual Styling:**
- **High importance**: Blue background with left border
- **Medium importance**: Normal text
- **Low importance**: Muted gray text

### Search Iteration Progress

Visual progress indicator for additional searches:

```
🔄 Additional Search 2/3  [sanskrit term]  ● ● ○
```

## Implementation Details

### SearcherAgent Changes

**Before (Multiple Parallel Searches):**
```typescript
// Generated 3 search terms
// Searched all 3 in parallel
// Combined all results
```

**After (Single Focused Search):**
```typescript
async search(context, searchRequest?) {
  // Generate ONE focused Sanskrit term
  const searchTerm = await this.generateSearchTerm(request);
  
  // Perform single semantic search
  const results = await searchTool.search(searchTerm, 10);
  
  return results;
}

async searchWithContext(searchRequest, previousResults) {
  // Additional search for iterative loop
  // Filters duplicates from previous results
  // Combines with accumulated results
}
```

### GeneratorAgent Changes

**Evaluation Logic:**
```typescript
async generate(context, searchResults, iterationCount) {
  // Check if more search needed (up to max 3 iterations)
  const needsMore = await this.checkIfNeedsMoreSearch(
    userQuery, 
    searchResults, 
    iterationCount
  );
  
  if (needsMore && iterationCount < 3) {
    return {
      requiresMoreSearch: true,
      searchQuery: "sanskrit_term",
      nextAgent: 'searcher'
    };
  }
  
  // Generate final answer
  return await this.generateFinalAnswer();
}
```

### Agent Communication

The agents communicate through a structured message flow:

```typescript
type AgentMessage = {
  id: string;
  role: AgentRole | 'user' | 'assistant';
  messageType: MessageType; // 'search-status' | 'verses' | 'assistant' | etc.
  content: string;
  metadata?: {
    searchIteration?: number;
    maxSearchIterations?: number;
    searchResults?: SearchResult[];
    highlightSections?: HighlightSection[];
    verseImportance?: Record<string, ImportanceLevel>;
  };
}
```

## Benefits

### 1. Intelligent Search Strategy with RigVeda Expertise
- Starts with RigVeda-contextual search terms
- **Score-aware evaluation**: Recognizes when results are poor quality
- **Makes knowledgeable guesses**: Uses RigVeda corpus knowledge to suggest better terms
- Refines based on actual gaps in information and relevance scores
- Avoids redundant searches
- Adapts search terms like a RigVeda scholar would

### 2. Efficient Resource Usage
- Only searches when needed
- Stops early if sufficient information found
- Maximum 4 total searches (1 initial + 3 refinements)

### 3. Better User Experience
- Clear visual progress indicators
- Interactive verse exploration
- Importance-based highlighting
- Transparent search process

### 4. Improved Answer Quality
- Generator evaluates sufficiency before answering
- Can request specific additional information
- Synthesizes across multiple search iterations
- Clear indication when information is insufficient

## UI Components

### CitationVerse.tsx
```typescript
// Collapsible verse display with relevance and source
export function CitationVerse({ verse, importance })

// Group of citations
export function CitationGroup({ verses, title, importance })
```

### HighlightedAnswer.tsx
```typescript
// Answer with importance-based section highlighting
export function HighlightedAnswer({ content, highlightSections })
```

### AgentChatMessage.tsx
Handles rendering of different message types:
- `'user'`: User queries
- `'search-status'`: Iteration progress
- `'verses'`: Search results with citations
- `'assistant'`: Final highlighted answers
- `'system'`: Status messages

## Search Iteration Examples

### Example 1: Sufficient After Initial Search
```
User: "What is Agni's role in Vedic rituals?"
  ↓
Search 1: "अग्नि यज्ञ" → 10 highly relevant results
  ↓
Generator: "Sufficient information available"
  ↓
Final Answer: [Comprehensive response with citations]
```

### Example 2: Low Scores - Intelligent Guess
```
User: "Tell me about Nasadiya Sukta"
  ↓
Search 1: "Nasadiya Sukta" → 5 results (avg score: 0.15 - LOW)
  ↓
Generator: "Low scores indicate poor match. This is the famous creation hymn in Mandala 10.129. Trying Sanskrit name..."
  ↓
Search 2: "नासदीय सूक्त" → 8 results (avg score: 0.72 - HIGH)
  ↓
Generator: "Excellent match! Sufficient information available"
  ↓
Final Answer: [Comprehensive response about creation hymn with proper citations]
```

### Example 3: Medium Scores - Refinement
```
User: "What is the significance of dawn in the RigVeda?"
  ↓
Search 1: "उषस्" → 8 results (avg score: 0.45 - MEDIUM)
  ↓
Generator: "Decent results but need more ritual context"
  ↓
Search 2: "उषस् ऋत यज्ञ" → 6 new results (dawn, cosmic order, sacrifice)
  ↓
Generator: "Sufficient information available"
  ↓
Final Answer: [Comprehensive response with citations]
```

### Example 4: Maximum Iterations
```
User: "Explain the philosophical concept of Rita"
  ↓
Search 1: "ऋत" → 7 results
Generator: "Need ethical dimension"
  ↓
Search 2: "ऋत धर्म" → 5 new results
Generator: "Need cosmological aspect"
  ↓
Search 3: "ऋत सत्य" → 4 new results
Generator: "Need practical application"
  ↓
Search 4: "ऋत यज्ञ" → 3 new results
  ↓
[Max iterations reached]
  ↓
Final Answer: [Best possible answer with all 19 gathered verses]
```

## Technical Considerations

### Client-Side Only
- No backend API routes
- Runs entirely in browser with WebLLM
- Uses IndexedDB for embeddings cache
- Deployable to GitHub Pages

### Performance
- Single search per iteration is faster than parallel
- Early termination saves computation
- Progressive information gathering
- Efficient duplicate filtering

### Extensibility
- Easy to adjust max iterations
- Can add more metadata to messages
- Importance scoring can be enhanced
- UI components are reusable

## Intelligent Search Term Generation

The system now includes **RigVeda corpus knowledge** in both the Searcher and Generator agents, enabling intelligent search term suggestions:

### RigVeda Knowledge Base
Both agents understand:
- **Structure**: 10 Mandalas, 1,028 hymns, 10,600+ verses
- **Major Deities**: Agni (अग्नि), Indra (इन्द्र), Soma (सोम), Varuna (वरुण), Ushas (उषस्)
- **Key Concepts**: Rita (ऋत), Yajna (यज्ञ), Dharma (धर्म), Brahman (ब्रह्मन्)
- **Famous Hymns**: Nasadiya Sukta (नासदीय सूक्त - 10.129), Purusha Sukta (पुरुष सूक्त - 10.90)
- **Reference Format**: Mandala.Hymn.Verse (e.g., 10.129.1)

### Intelligent Term Mapping
When search scores are low, the Generator makes educated guesses:

| User Query | Low Score Result | Intelligent Guess | Rationale |
|------------|------------------|-------------------|-----------|
| "Nasadiya Sukta" | 0.15 | "नासदीय सूक्त" or "नासदासीत्" | Sanskrit name or first word of hymn |
| "Fire God" | 0.18 | "अग्नि" | Correct Sanskrit deity name |
| "cosmic order" | 0.22 | "ऋत" | Key RigVeda philosophical concept |
| "creation hymn" | 0.20 | "सृष्टि सूक्त" or "मण्डल १०" | Sanskrit term or Mandala reference |
| "sacrifice ritual" | 0.25 | "यज्ञ" | Primary Sanskrit term for sacrifice |

### Score-Based Decision Making
```
If avgScore < 0.3:
  → Make intelligent guess using RigVeda knowledge
  → Consider: Sanskrit terms, deity names, Mandala references
  
Else if avgScore < 0.6:
  → Results relevant but need refinement
  → Request specific missing aspects
  
Else:
  → High quality results
  → Evaluate content sufficiency
```

## Future Enhancements

1. **Adaptive Iteration Limit**: Adjust based on query complexity and score trends
2. **Verse Ranking**: Use importance scoring for better citation ordering
3. **Search History**: Show all search terms used in the conversation
4. **Export with Citations**: Include interactive citations in PDF exports
5. **Verse Linking**: Link related verses across searches
6. **Learning System**: Track successful search term patterns for better suggestions

## Conclusion

The new iterative search workflow with generative UI provides:
- More intelligent and efficient search strategy
- Better user transparency and engagement
- Higher quality answers through iterative refinement
- Modern, interactive citation display
- Fully client-side operation for GitHub Pages deployment
