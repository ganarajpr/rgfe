'use client';

import { marked } from 'marked';
import { useEffect, useState } from 'react';

interface HighlightedAnswerProps {
  readonly content: string;
  readonly highlightSections?: ReadonlyArray<{
    readonly start: number;
    readonly end: number;
    readonly importance: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Component that displays an answer with sections highlighted or dulled based on importance
 * Supports markdown rendering with importance-based styling
 */
export function HighlightedAnswer({ content, highlightSections }: HighlightedAnswerProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    const renderMarkdown = async () => {
      try {
        // First, process special Sanskrit and translation tags
        let processedContent = content;
        
        // Replace <sanskrit> tags with special markers for later processing
        processedContent = processedContent.replace(
          /<sanskrit>(.*?)<\/sanskrit>/gs,
          (match, sanskritText) => {
            return `SANSKRIT_START_PLACEHOLDER${sanskritText.trim()}SANSKRIT_END_PLACEHOLDER`;
          }
        );
        
        // Replace <translation> tags with special markers
        processedContent = processedContent.replace(
          /<translation>(.*?)<\/translation>/gs,
          (match, translationText) => {
            return `TRANSLATION_START_PLACEHOLDER${translationText.trim()}TRANSLATION_END_PLACEHOLDER`;
          }
        );
        
        const html = await marked.parse(processedContent, { 
          async: true,
          breaks: true,
          gfm: true,
        });
        
        // Now process the special markers in the HTML
        let finalHtml = html;
        
        // Replace Sanskrit markers with styled divs
        finalHtml = finalHtml.replace(
          /SANSKRIT_START_PLACEHOLDER(.*?)SANSKRIT_END_PLACEHOLDER/gs,
          (match, sanskritText) => {
            return `<div class="sanskrit-verse">${sanskritText}</div>`;
          }
        );
        
        // Replace translation markers with styled divs
        finalHtml = finalHtml.replace(
          /TRANSLATION_START_PLACEHOLDER(.*?)TRANSLATION_END_PLACEHOLDER/gs,
          (match, translationText) => {
            return `<div class="sanskrit-translation">${translationText}</div>`;
          }
        );
        
        // Enhance verse references (RV 5.1.8, RigVeda 5.1.8, etc.)
        finalHtml = finalHtml.replace(
          /\*\*(RV|RigVeda)\s+(\d+\.\d+\.\d+)\*\*/g,
          '<span class="verse-reference">$1 $2</span>'
        );
        
        setHtmlContent(finalHtml);
      } catch (error) {
        console.error('Error rendering markdown:', error);
        setHtmlContent(content);
      }
    };

    renderMarkdown();
  }, [content]);

  // If no highlight sections provided, render normally
  if (!highlightSections || highlightSections.length === 0) {
    return (
      <div 
        className="prose prose-sm max-w-none prose-headings:text-gray-700 prose-p:text-gray-700 prose-strong:text-gray-900 prose-em:text-gray-600"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  }

  // Split content into sections with importance levels
  const sections: { text: string; importance: 'high' | 'medium' | 'low' | 'normal' }[] = [];
  let lastIndex = 0;

  // Sort sections by start position
  const sortedSections = [...highlightSections].sort((a, b) => a.start - b.start);

  for (const section of sortedSections) {
    // Add text before this section (if any) as normal importance
    if (section.start > lastIndex) {
      sections.push({
        text: content.slice(lastIndex, section.start),
        importance: 'normal',
      });
    }

    // Add the highlighted section
    sections.push({
      text: content.slice(section.start, section.end),
      importance: section.importance,
    });

    lastIndex = section.end;
  }

  // Add remaining text as normal
  if (lastIndex < content.length) {
    sections.push({
      text: content.slice(lastIndex),
      importance: 'normal',
    });
  }

  const getImportanceClass = (importance: string) => {
    switch (importance) {
      case 'high':
        return 'bg-blue-50 border-l-4 border-blue-500 pl-3 py-1 font-medium text-gray-900';
      case 'medium':
        return 'text-gray-700';
      case 'low':
        return 'text-gray-500';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const sectionId = `section-${section.text.substring(0, 20).replace(/\s/g, '-')}`;
        
        if (section.importance === 'high') {
          return (
            <div key={sectionId} className={getImportanceClass(section.importance)}>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: marked.parse(section.text, { breaks: true, gfm: true }) as string 
                }}
              />
            </div>
          );
        }
        
        return (
          <div 
            key={sectionId} 
            className={getImportanceClass(section.importance)}
            dangerouslySetInnerHTML={{ 
              __html: marked.parse(section.text, { breaks: true, gfm: true }) as string 
            }}
          />
        );
      })}
    </div>
  );
}
