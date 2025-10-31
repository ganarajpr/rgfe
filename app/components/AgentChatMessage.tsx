'use client';

import { useEffect } from 'react';
import { AgentMessage } from '../lib/agents/types';
import { CitationVerse } from './CitationVerse';
import { FinalAnswerDisplay } from './FinalAnswerDisplay';

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
      <div className="flex gap-3 py-3 px-4 mx-auto max-w-4xl">
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 w-full">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-600 font-medium italic">{message.content}</span>
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
        <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-blue-800 italic">
                🔄 Additional Search {iteration}/{maxIterations}
              </span>
              {searchQuery && (
                <span className="text-xs text-blue-700 font-mono bg-white px-3 py-1 rounded-full border border-blue-300 italic">
                  {searchQuery}
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: maxIterations }, (_, i) => i).map((dotIndex) => (
                <div
                  key={`iteration-dot-${dotIndex}`}
                  className={`w-2 h-2 rounded-full transition-colors ${
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
        <div className="flex-1 space-y-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <span className="text-sm font-semibold text-blue-800 italic">📜 Found Verses</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full italic">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm space-y-4">
            <div className="text-sm text-blue-800 font-medium italic">
              {message.content}
            </div>
            
            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <CitationVerse
                    key={result.bookContext || result.title}
                    verse={result}
                    importance={verseImportance[result.bookContext || result.title] || 'medium'}
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
    const toolCall = message.metadata?.toolCall;
    
    return (
      <div className="flex gap-4 py-4 px-4">
        <div className="flex-1 space-y-4 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-semibold text-green-800 italic">
              🔍 Search Iteration {iteration + 1}/{maxIterations + 1}
            </span>
            {toolCall && (
              <span className="text-xs text-green-600 font-mono bg-green-100 px-3 py-1 rounded-full border border-green-300 italic">
                🔧 {toolCall.name}({toolCall.parameters.userQuery}{toolCall.parameters.searchSuggestion ? `, ${toolCall.parameters.searchSuggestion}` : ''})
              </span>
            )}
            {searchTerm && (
              <span className="text-xs text-green-700 font-mono bg-white px-3 py-1 rounded-full border border-green-300 italic">
                {searchTerm}
              </span>
            )}
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full italic">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-green-800 font-semibold italic">
                Found {searchResults.length} verses
              </div>
            </div>
            
            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <CitationVerse
                    key={result.bookContext || result.title}
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
        <div className="flex-1 space-y-3 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-gray-500 rounded-full" />
            <span className="text-sm font-semibold text-gray-600">You</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="bg-gray-800 text-gray-100 px-4 py-4 rounded-lg shadow-sm">
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages - Use FinalAnswerDisplay for structured verse rendering
  const isFinalAnswer = message.metadata?.isComplete;
  
  return (
    <div className="flex gap-4 py-6 px-4">
      <div className="flex-1 space-y-3 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
          <span className="text-sm font-semibold text-gray-600">Assistant</span>
          {isFinalAnswer && (
            <span className="text-sm font-semibold text-amber-700 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
              📝 Final Answer
            </span>
          )}
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className={`px-6 py-5 rounded-lg shadow-md text-gray-700 ${
          isFinalAnswer 
            ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 ring-2 ring-amber-200 ring-opacity-50' 
            : 'bg-white border border-gray-200 shadow-sm'
        }`}>
          {isStreaming && !message.content && (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
              <span>Generating answer...</span>
            </div>
          )}
          {message.content && (
            <FinalAnswerDisplay
              content={message.content}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentChatMessage;

