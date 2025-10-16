'use client';

import { useState, useEffect } from 'react';
import { VerseCard } from './VerseCard';
import { ImportanceLevel } from '../lib/agents/types';

interface ParsedVerse {
  reference: string;
  sanskrit: string;
  translation: string;
  importance: ImportanceLevel;
}

interface ParsedContent {
  introduction: string;
  verses: {
    high: ParsedVerse[];
    medium: ParsedVerse[];
    low: ParsedVerse[];
  };
  conclusion: string;
}

interface FinalAnswerDisplayProps {
  readonly content: string;
}

/**
 * Component that parses and displays the generator's final answer with structured verse cards
 */
export function FinalAnswerDisplay({ content }: FinalAnswerDisplayProps) {
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null);

  useEffect(() => {
    const parseContent = () => {
      try {
        // For the new flowing format, we'll extract verses and render the rest as prose
        const result: ParsedContent = {
          introduction: '',
          verses: { high: [], medium: [], low: [] },
          conclusion: ''
        };

        // Find all verse references in the content
        const verseRegex = /###\s*(?:RV|RigVeda)\s+(\d+\.\d+\.\d+)/gi;
        const verses: Array<{ reference: string; sanskrit: string; translation: string; importance: ImportanceLevel }> = [];
        
        let match;
        while ((match = verseRegex.exec(content)) !== null) {
          const reference = `RigVeda ${match[1]}`;
          const startIndex = match.index;
          
          // Find the content between this verse reference and the next one (or end)
          const nextVerseIndex = content.indexOf('### RigVeda', startIndex + match[0].length);
          const verseSection = nextVerseIndex === -1 
            ? content.substring(startIndex)
            : content.substring(startIndex, nextVerseIndex);
          
          // Extract Sanskrit text (between <sanskrit> tags)
          const sanskritRegex = /<sanskrit>(.*?)<\/sanskrit>/s;
          const sanskritMatch = sanskritRegex.exec(verseSection);
          const sanskrit = sanskritMatch ? sanskritMatch[1].trim() : '';

          // Extract translation (between <translation> tags)
          const translationRegex = /<translation>(.*?)<\/translation>/s;
          const translationMatch = translationRegex.exec(verseSection);
          const translation = translationMatch ? translationMatch[1].trim() : '';

          if (sanskrit && translation) {
            verses.push({
              reference,
              sanskrit,
              translation,
              importance: 'medium' // Default importance, could be enhanced later
            });
          }
        }

        // For now, put all verses in medium importance
        result.verses.medium = verses;
        
        // The entire content is the flowing answer
        result.introduction = content;
        result.conclusion = '';

        setParsedContent(result);
      } catch (error) {
        console.error('Error parsing content:', error);
        // Fallback: treat entire content as introduction
        setParsedContent({
          introduction: content,
          verses: { high: [], medium: [], low: [] },
          conclusion: ''
        });
      }
    };

    parseContent();
  }, [content]);

  if (!parsedContent) {
    return (
      <div className="prose prose-sm max-w-none">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    );
  }

  const totalVerses = parsedContent.verses.high.length + parsedContent.verses.medium.length + parsedContent.verses.low.length;
  const hasVerses = totalVerses > 0;

  // For the new flowing format, render the content with embedded verse cards
  const renderFlowingContent = () => {
    if (!hasVerses) {
      return (
        <div className="prose prose-sm max-w-none prose-p:text-gray-700 prose-strong:text-gray-900">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      );
    }

    // Split content by verse references and render with embedded cards
    const verseRegex = /###\s*(?:RV|RigVeda)\s+(\d+\.\d+\.\d+)/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = verseRegex.exec(content)) !== null) {
      // Add text before the verse
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        if (textBefore.trim()) {
          parts.push({
            type: 'text',
            content: textBefore.trim()
          });
        }
      }

      // Find the verse data
      const reference = `RigVeda ${match[1]}`;
      const verse = parsedContent.verses.medium.find(v => v.reference === reference);
      
      if (verse) {
        parts.push({
          type: 'verse',
          verse: verse
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);
      if (remainingText.trim()) {
        parts.push({
          type: 'text',
          content: remainingText.trim()
        });
      }
    }

    return (
      <div className="space-y-4">
        {parts.map((part, index) => {
          if (part.type === 'text' && part.content) {
            return (
              <div 
                key={`text-${index}-${part.content.substring(0, 20)}`}
                className="prose prose-sm max-w-none prose-p:text-gray-700 prose-strong:text-gray-900"
                dangerouslySetInnerHTML={{ __html: part.content }}
              />
            );
          } else if (part.type === 'verse' && part.verse) {
            return (
              <div key={`verse-${part.verse.reference}-${index}`} className="my-6">
                <VerseCard
                  verseReference={part.verse.reference}
                  sanskritText={part.verse.sanskrit}
                  translation={part.verse.translation}
                  importance={part.verse.importance}
                  isCollapsible={false}
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return renderFlowingContent();
}
