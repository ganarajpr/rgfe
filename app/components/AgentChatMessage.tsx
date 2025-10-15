'use client';

import { useEffect } from 'react';
import { AgentMessage } from '../lib/agents/types';
import { CitationVerse } from './CitationVerse';
import { HighlightedAnswer } from './HighlightedAnswer';

interface AgentChatMessageProps {
  message: AgentMessage;
  isStreaming?: boolean;
}

const AgentChatMessage = ({ message, isStreaming }: AgentChatMessageProps) => {
  // Remove unused state - content is handled by HighlightedAnswer component
  useEffect(() => {
    // Effect to trigger re-render when message content changes
  }, [message.content, message.messageType]);

  // System/status messages (agent notifications)
  if (message.messageType === 'system' || message.messageType === 'thinking') {
    return (
      <div className="flex gap-3 py-2 px-4 mx-auto max-w-4xl">
        <div className="flex items-center gap-2 text-sm text-gray-500 italic">
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  // Search iteration status message
  if (message.messageType === 'search-status') {
    const iteration = message.metadata?.searchIteration || 0;
    const maxIterations = message.metadata?.maxSearchIterations || 3;
    const searchQuery = message.metadata?.searchQuery || '';
    
    return (
      <div className="flex gap-3 py-3 px-4 mx-auto max-w-4xl">
        <div className="flex-1 bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-700">
                🔄 Additional Search {iteration}/{maxIterations}
              </span>
              {searchQuery && (
                <span className="text-xs text-blue-600 font-mono bg-white px-2 py-1 rounded">
                  {searchQuery}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: maxIterations }, (_, i) => i).map((dotIndex) => (
                <div
                  key={`iteration-dot-${dotIndex}`}
                  className={`w-2 h-2 rounded-full ${
                    dotIndex < iteration ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Verses display (search results) - Using new CitationVerse component
  if (message.messageType === 'verses') {
    const searchResults = message.metadata?.searchResults || [];
    const verseImportance = message.metadata?.verseImportance || {};
    
    return (
      <div className="flex gap-4 py-6 px-4">
        <div className="flex-1 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-600">📜 Found Verses</span>
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg space-y-3">
            <div className="text-sm text-blue-800 font-medium">
              {message.content}
            </div>
            
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <CitationVerse
                    key={result.id}
                    verse={result}
                    importance={verseImportance[result.id] || 'medium'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Search results display (specific iteration results)
  if (message.messageType === 'search-results') {
    const searchResults = message.metadata?.searchResults || [];
    const searchTerm = message.metadata?.searchTerm || '';
    const iteration = message.metadata?.searchIteration || 0;
    const maxIterations = message.metadata?.maxSearchIterations || 3;
    const avgRelevanceScore = message.metadata?.avgRelevanceScore || 0;
    
    return (
      <div className="flex gap-4 py-4 px-4">
        <div className="flex-1 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-600">
              🔍 Search Iteration {iteration + 1}/{maxIterations + 1}
            </span>
            {searchTerm && (
              <span className="text-xs text-green-600 font-mono bg-white px-2 py-1 rounded border">
                {searchTerm}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-green-800 font-medium">
                Found {searchResults.length} verses
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <CitationVerse
                    key={result.id}
                    verse={result}
                    importance="medium"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // User messages - Dark background with light text for contrast
  if (message.messageType === 'user') {
    return (
      <div className="flex gap-4 py-6 px-4">
        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">You</span>
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="bg-gray-800 text-gray-100 px-4 py-3 rounded-lg">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages - Light bordered background for clear separation
  return (
    <div className="flex gap-4 py-6 px-4">
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Assistant</span>
          <span className="text-xs text-gray-400">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="border-2 border-gray-200 bg-gray-50 px-4 py-4 rounded-lg text-gray-700">
          {isStreaming && !message.content && (
            <span className="text-gray-400">...</span>
          )}
          {message.content && (
            <HighlightedAnswer
              content={message.content}
              highlightSections={message.metadata?.highlightSections}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentChatMessage;

