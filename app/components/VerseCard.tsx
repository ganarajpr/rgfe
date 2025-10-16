'use client';

import { useState } from 'react';
import { ImportanceLevel } from '../lib/agents/types';

interface VerseCardProps {
  readonly verseReference: string;
  readonly sanskritText: string;
  readonly translation: string;
  readonly importance?: ImportanceLevel;
  readonly isCollapsible?: boolean;
  readonly showCopyButton?: boolean;
}

/**
 * A beautiful, structured card component for displaying RigVeda verses
 * with proper typography, spacing, and visual hierarchy
 */
export function VerseCard({ 
  verseReference, 
  sanskritText, 
  translation, 
  importance = 'medium',
  isCollapsible = false,
  showCopyButton = true
}: VerseCardProps) {
  const [isExpanded, setIsExpanded] = useState(!isCollapsible);
  const [copySuccess, setCopySuccess] = useState(false);

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
    }
  };

  const getImportanceDotColor = (level: ImportanceLevel) => {
    if (level === 'high') return 'bg-blue-500';
    if (level === 'medium') return 'bg-gray-500';
    return 'bg-gray-400';
  };

  const styles = getImportanceStyles(importance);

  const handleCopyVerse = async () => {
    const verseText = `${verseReference}\n\n${sanskritText}\n\n${translation}`;
    try {
      await navigator.clipboard.writeText(verseText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy verse:', error);
    }
  };

  const handleToggle = () => {
    if (isCollapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  const headerContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${getImportanceDotColor(importance)}`} />
        <h3 className="font-semibold text-sm">
          {verseReference}
        </h3>
        {importance === 'high' && (
          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full font-medium">
            High Importance
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {showCopyButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyVerse();
            }}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded transition-colors"
            title="Copy verse"
          >
            {copySuccess ? (
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
        
        {isCollapsible && (
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
        )}
      </div>
    </div>
  );

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${styles.container} ${styles.accent}`}>
      {/* Header with verse reference */}
      {isCollapsible ? (
        <button 
          className={`w-full px-4 py-3 border-b ${styles.header} text-left`}
          onClick={handleToggle}
          type="button"
        >
          {headerContent}
        </button>
      ) : (
        <div className={`px-4 py-3 border-b ${styles.header}`}>
          {headerContent}
        </div>
      )}

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Sanskrit Text */}
          <div className="bg-amber-50 border-l-4 border-amber-400 pl-4 py-3 rounded-r-lg">
            <div className="sanskrit-verse text-amber-900 text-lg font-semibold leading-relaxed">
              {sanskritText}
            </div>
          </div>

          {/* Translation */}
          <div className="bg-white border-l-4 border-gray-300 pl-4 py-3 rounded-r-lg">
            <div className="text-gray-700 text-base leading-relaxed">
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Translation:</span>
              <div className="mt-1 italic">
                {translation}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface VerseGroupProps {
  readonly title: string;
  readonly verses: Array<{
    reference: string;
    sanskrit: string;
    translation: string;
    importance?: ImportanceLevel;
  }>;
  readonly importance?: ImportanceLevel;
  readonly isCollapsible?: boolean;
}

/**
 * A group of verses displayed together with a title
 */
export function VerseGroup({ title, verses, importance = 'medium' }: VerseGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-left w-full"
      >
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <span className="text-sm text-gray-500">({verses.length} verse{verses.length !== 1 ? 's' : ''})</span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
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
      
      {isExpanded && (
        <div className="space-y-3">
          {verses.map((verse, index) => (
            <VerseCard
              key={`${verse.reference}-${index}`}
              verseReference={verse.reference}
              sanskritText={verse.sanskrit}
              translation={verse.translation}
              importance={verse.importance || importance}
              isCollapsible={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}