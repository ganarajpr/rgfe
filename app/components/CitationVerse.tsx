'use client';

import { useState } from 'react';
import { SearchResult, ImportanceLevel } from '../lib/agents/types';

interface CitationVerseProps {
  readonly verse: SearchResult;
  readonly importance?: ImportanceLevel;
}

/**
 * A collapsible citation verse component that can be expanded/collapsed
 * Shows relevance score and source information
 */
function getImportanceDotColor(importance: ImportanceLevel): string {
  if (importance === 'high') return 'bg-blue-500';
  if (importance === 'medium') return 'bg-gray-400';
  return 'bg-gray-300';
}

// function getRelevanceBarColor(relevance: number): string {
//   if (relevance > 0.7) return 'bg-blue-500';
//   if (relevance > 0.5) return 'bg-gray-400';
//   return 'bg-gray-300';
// }

export function CitationVerse({ verse, importance = 'medium' }: CitationVerseProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const importanceStyles = {
    high: 'border-blue-200 bg-blue-50',
    medium: 'border-gray-200 bg-gray-50',
    low: 'border-gray-100 bg-gray-50',
  };

  const verseRef = verse.bookContext || verse.title;
  const actualImportance = verse.importance || importance;

  return (
    <div 
      className={`border ${importanceStyles[actualImportance]} rounded-lg overflow-hidden transition-all ${
        verse.isFiltered ? 'opacity-60' : ''
      }`}
    >
      {/* Collapsed Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-2 h-2 rounded-full ${
            getImportanceDotColor(actualImportance)
          }`} />
          <span className="text-sm font-medium text-gray-700">
            {verseRef}
          </span>
          {verse.isFiltered && (
            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
              Filtered
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200">
          <div className="pt-3 space-y-3">
            {/* Source Information */}
            {verse.source && (
              <div className="text-xs text-gray-500">
                <span className="font-medium">Source:</span> {verse.source}
              </div>
            )}

            {/* Sanskrit Content */}
            {verse.content && (
              <div className="prose prose-sm max-w-none">
                <div className="text-gray-700 whitespace-pre-wrap sanskrit-text">
                  {verse.content}
                </div>
              </div>
            )}

            {/* Translation */}
            {verse.translation && (
              <div className="prose prose-sm max-w-none">
                <div className="text-gray-600 italic text-sm">
                  <strong>Translation:</strong> {verse.translation}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

interface CitationGroupProps {
  readonly verses: SearchResult[];
  readonly title?: string;
  readonly importance?: ImportanceLevel;
}

/**
 * A group of citation verses displayed together
 */
export function CitationGroup({ verses, title, importance }: CitationGroupProps) {
  return (
    <div className="space-y-2">
      {title && (
        <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      )}
      <div className="space-y-2">
        {verses.map((verse) => (
          <CitationVerse 
            key={verse.id} 
            verse={verse} 
            importance={importance}
          />
        ))}
      </div>
    </div>
  );
}
