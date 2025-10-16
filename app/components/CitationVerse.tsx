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
 * Updated to align with new VerseCard design
 */
function getImportanceDotColor(importance: ImportanceLevel): string {
  if (importance === 'high') return 'bg-blue-500';
  if (importance === 'medium') return 'bg-gray-500';
  return 'bg-gray-400';
}

export function CitationVerse({ verse, importance = 'medium' }: CitationVerseProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Defensive check for verse prop
  if (!verse) {
    return null;
  }

  const getImportanceStyles = (level: ImportanceLevel) => {
    switch (level) {
      case 'high':
        return {
          container: 'bg-blue-50 border-blue-200 shadow-sm',
          header: 'bg-blue-100 border-blue-300 text-blue-900',
          accent: 'border-l-4 border-blue-500'
        };
      case 'medium':
        return {
          container: 'bg-gray-50 border-gray-200 shadow-sm',
          header: 'bg-gray-100 border-gray-300 text-gray-900',
          accent: 'border-l-4 border-gray-400'
        };
      case 'low':
        return {
          container: 'bg-gray-50 border-gray-100 shadow-sm',
          header: 'bg-gray-50 border-gray-200 text-gray-700',
          accent: 'border-l-4 border-gray-300'
        };
      default:
        // Default to medium importance styling
        return {
          container: 'bg-gray-50 border-gray-200 shadow-sm',
          header: 'bg-gray-100 border-gray-300 text-gray-900',
          accent: 'border-l-4 border-gray-400'
        };
    }
  };

  const verseRef = verse.bookContext || verse.title;
  const actualImportance = verse.importance || importance;
  const styles = getImportanceStyles(actualImportance) || {
    container: 'bg-gray-50 border-gray-200 shadow-sm',
    header: 'bg-gray-100 border-gray-300 text-gray-900',
    accent: 'border-l-4 border-gray-400'
  };

  return (
    <div 
      className={`border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${styles.container} ${styles.accent} ${
        verse.isFiltered ? 'opacity-60' : ''
      }`}
    >
      {/* Header with verse reference */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-4 py-3 border-b ${styles.header} hover:bg-opacity-80 transition-colors text-left`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              getImportanceDotColor(actualImportance)
            }`} />
            <span className="font-semibold text-sm">
              {verseRef}
            </span>
            {actualImportance === 'high' && (
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-medium">
                High Importance
              </span>
            )}
            {verse.isFiltered && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                Filtered
              </span>
            )}
          </div>
          
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
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
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Source Information */}
          {verse.source && (
            <div className="text-xs text-gray-500 bg-white px-3 py-2 rounded border">
              <span className="font-medium">Source:</span> {verse.source}
            </div>
          )}

          {/* Sanskrit Content */}
          {verse.content && (
            <div className="bg-amber-50 border-l-4 border-amber-400 pl-4 py-3 rounded-r-lg">
              <div className="sanskrit-verse text-amber-900 text-lg font-semibold leading-relaxed">
                {verse.content}
              </div>
            </div>
          )}

          {/* Translation */}
          {verse.translation && (
            <div className="bg-white border-l-4 border-gray-300 pl-4 py-3 rounded-r-lg">
              <div className="text-gray-700 text-base leading-relaxed">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Translation:</span>
                <div className="mt-1 italic">
                  {verse.translation}
                </div>
              </div>
            </div>
          )}
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
