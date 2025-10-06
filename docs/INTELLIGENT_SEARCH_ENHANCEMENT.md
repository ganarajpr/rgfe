# Intelligent Search Enhancement - Score-Aware Term Generation

## Overview

The RigVeda Assistant now features **intelligent search term generation** that uses relevance scores and RigVeda corpus knowledge to make smart guesses when initial search results are poor quality.

## The Problem

Previously, when a user searched for "Nasadiya Sukta" (a famous RigVeda hymn), the system might:
- Generate a Sanskrit term that doesn't quite match the corpus
- Return results with low similarity scores (< 0.3)
- Not recognize that better search terms exist
- Waste iterations on similar unsuccessful searches

## The Solution

### Score-Aware Intelligence

The Generator agent now analyzes relevance scores and responds accordingly:

```typescript
Average Score < 0.3  → ❌ LOW - Make intelligent guess
Average Score 0.3-0.6 → ⚠️ MEDIUM - Refine with specifics  
Average Score > 0.6  → ✅ HIGH - Proceed if content sufficient
```

### RigVeda Corpus Knowledge

Both Searcher and Generator agents now include comprehensive RigVeda knowledge:

**Structure:**
- 10 Mandalas (books)
- 1,028 hymns (Suktas)  
- 10,600+ verses (Richas)
- Reference format: Mandala.Hymn.Verse (e.g., 10.129.1)

**Major Deities:**
- Agni (अग्नि) - Fire
- Indra (इन्द्र) - Thunder/War
- Soma (सोम) - Sacred plant/deity
- Varuna (वरुण) - Cosmic order
- Ushas (उषस्) - Dawn

**Key Concepts:**
- Rita (ऋत) - Cosmic order
- Yajna (यज्ञ) - Sacrifice/ritual
- Dharma (धर्म) - Righteousness/duty
- Brahman (ब्रह्मन्) - Ultimate reality

**Famous Hymns:**
- Nasadiya Sukta (नासदीय सूक्त) - Creation hymn, Mandala 10.129
- Purusha Sukta (पुरुष सूक्त) - Cosmic being, Mandala 10.90
- Gayatri Mantra (गायत्री मन्त्र) - Sacred verse, Mandala 3.62.10

## How It Works

### Example Workflow: Low Score Recovery

```
User Query: "Tell me about Nasadiya Sukta"

Search 1:
  Term: "Nasadiya Sukta" (English)
  Results: 5 verses
  Average Score: 0.15 ❌ LOW
  
Generator Analysis:
  "Low scores indicate poor match. Nasadiya Sukta is the famous 
   creation hymn in Mandala 10.129. Let me try the Sanskrit name..."
  
Search 2:
  Term: "नासदीय सूक्त" (Sanskrit)
  Results: 8 verses
  Average Score: 0.72 ✅ HIGH
  
Generator Analysis:
  "Excellent match! These verses directly address the creation hymn.
   Sufficient information to generate comprehensive answer."
  
Final Answer:
  [Comprehensive response with proper citations from Mandala 10.129]
```

## Intelligent Term Mapping Examples

| User Query | Initial Score | Intelligent Guess | Why It Works |
|------------|---------------|-------------------|--------------|
| "Nasadiya Sukta" | 0.15 | "नासदीय सूक्त" | Sanskrit name matches corpus |
| "Fire God" | 0.18 | "अग्नि" | Correct Sanskrit deity name |
| "cosmic order" | 0.22 | "ऋत" | Key philosophical concept term |
| "creation hymn" | 0.20 | "सृष्टि सूक्त" | Sanskrit term for creation |
| "dawn goddess" | 0.25 | "उषस्" | Correct deity name |
| "sacrifice ritual" | 0.23 | "यज्ञ" | Primary Sanskrit term |

## Implementation Details

### Generator Agent Enhancements

**System Prompt Additions:**
```typescript
CORPUS KNOWLEDGE - The RigVeda:
- 10 Mandalas with 1,028 hymns containing 10,600+ verses
- Verses in Vedic Sanskrit (Devanagari script)
- Major deities: Agni, Indra, Soma, Varuna, Ushas
- Key concepts: Rita, Yajna, Dharma
- Famous hymns: Nasadiya Sukta (10.129), Purusha Sukta (10.90)

CHECK RELEVANCE SCORES:
- LOW SCORES (<0.3): Make intelligent guesses for better terms
- MEDIUM SCORES (0.3-0.6): Refine based on content gaps
- HIGH SCORES (>0.6): Evaluate content sufficiency
```

**Score Analysis in Prompts:**
```typescript
RELEVANCE SCORE ANALYSIS:
- Average Score: 15.0% (❌ LOW - Results likely poor match)
- Highest Score: 22.0%
- Total Results: 5

CRITICAL SCORING GUIDANCE:
If average score < 0.3: Make an INTELLIGENT GUESS
  * Think: What Sanskrit term would a RigVeda scholar use?
  * Example: "Nasadiya Sukta" → "नासदीय" or "सृष्टि सूक्त"
```

### Searcher Agent Enhancements

**Sanskrit Term Generation:**
```typescript
RIGVEDA CORPUS KNOWLEDGE:
- Major deities: Agni (अग्नि), Indra (इन्द्र), Soma (सोम)
- Key concepts: Rita (ऋत), Yajna (यज्ञ), Brahman (ब्रह्मन्)
- Famous hymns: Nasadiya (नासदीय सूक्त), Purusha (पुरुष सूक्त)

THINK: What Sanskrit term would ACTUALLY appear in RigVeda verses?
- Deity names → Sanskrit (e.g., "Agni" → "अग्नि")
- Concepts → Vedic Sanskrit (e.g., "cosmic order" → "ऋत")
- Famous hymns → Sanskrit name (e.g., "Nasadiya" → "नासदीय")
```

## Benefits

### 1. Recovery from Poor Initial Searches
- Recognizes low-quality results immediately
- Makes educated guesses based on RigVeda knowledge
- Avoids wasting iterations on similar poor terms

### 2. Context-Aware Term Generation
- Understands RigVeda structure and content
- Suggests terms that actually exist in the corpus
- Maps English concepts to Sanskrit equivalents

### 3. Efficient Iteration Usage
- Uses early iterations for course correction
- Reserves later iterations for refinement
- Maximizes chance of finding relevant verses

### 4. Scholarly Accuracy
- Terms suggested mirror how RigVeda scholars would search
- Respects traditional references (Mandala.Hymn.Verse)
- Uses authentic Sanskrit terminology

## Score Thresholds

### Low Score (<0.3)
**Meaning:** Results likely don't match the query intent  
**Action:** Make intelligent guess for better term  
**Strategy:** Use RigVeda knowledge to suggest alternatives

### Medium Score (0.3-0.6)
**Meaning:** Results are relevant but could be improved  
**Action:** Refine based on content gaps  
**Strategy:** Request specific missing aspects

### High Score (>0.6)
**Meaning:** Strong match to query  
**Action:** Evaluate if content answers question  
**Strategy:** Proceed with generation if sufficient

## Testing Scenarios

### Scenario 1: English Hymn Name
```
Query: "Nasadiya Sukta"
Expected: Recognize as creation hymn → "नासदीय सूक्त"
Result: High-quality matches from Mandala 10.129
```

### Scenario 2: English Deity Name
```
Query: "Fire God"
Expected: Map to primary deity → "अग्नि"
Result: Numerous hymns dedicated to Agni
```

### Scenario 3: Conceptual Query
```
Query: "What is cosmic order in Vedic philosophy?"
Expected: Recognize Rita concept → "ऋत"
Result: Verses explaining Rita from various Mandalas
```

### Scenario 4: Mixed Language Query
```
Query: "Tell me about Agni and fire rituals"
Expected: Already has Sanskrit term, combine with "यज्ञ"
Result: Hymns about Agni in ritual contexts
```

## Console Logging

The system provides detailed logging for transparency:

```
🧠 Generating Sanskrit search term for: "Nasadiya Sukta"
   Generated Sanskrit search term: "नासदीय सूक्त"

🔍 Performing search with term: "नासदीय सूक्त"
   ✅ Found 8 results

🤖 Generator analysis:
RELEVANCE SCORE ANALYSIS:
- Average Score: 72.0% (✅ HIGH - Strong match)
- Highest Score: 85.0%

✅ Sufficient information available: Results directly address creation hymn
```

## Future Improvements

1. **Score History Tracking**: Learn which term transformations work best
2. **Multi-term Combinations**: Try compound Sanskrit terms
3. **Mandala-Specific Searches**: Target specific books when appropriate
4. **Synonym Expansion**: Try related Sanskrit terms automatically
5. **User Feedback Loop**: Learn from which results users find helpful

## Conclusion

The intelligent search enhancement transforms the RigVeda Assistant from a basic search tool into a knowledgeable guide that understands:
- What terms actually exist in the RigVeda corpus
- How to recognize poor search results
- When to make intelligent guesses for better terms
- How to map English concepts to Sanskrit equivalents

This creates a more robust, efficient, and scholarly-accurate search experience that helps users find relevant RigVeda content even when their initial queries use English terminology or approximate names.
