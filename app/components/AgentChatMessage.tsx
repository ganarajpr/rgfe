'use client';

import { marked } from 'marked';
import { useEffect, useState } from 'react';
import { AgentMessage } from '../lib/agents/types';

interface AgentChatMessageProps {
  message: AgentMessage;
  isStreaming?: boolean;
}

const AgentChatMessage = ({ message, isStreaming }: AgentChatMessageProps) => {
  const [renderedContent, setRenderedContent] = useState<string>('');

  useEffect(() => {
    if (message.messageType === 'assistant') {
      const parseMarkdown = async () => {
        const html = await marked.parse(message.content);
        setRenderedContent(html);
      };
      parseMarkdown();
    } else {
      setRenderedContent(message.content);
    }
  }, [message.content, message.messageType]);

  // System/status messages (agent notifications)
  if (message.messageType === 'system' || message.messageType === 'thinking') {
    return (
      <div className="flex gap-3 py-2 px-4 mx-auto max-w-4xl">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  // Verses display (search results)
  if (message.messageType === 'verses') {
    const searchResults = message.metadata?.searchResults || [];
    
    return (
      <div className="flex gap-4 py-6 px-4">
        <div className="flex-1 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-600">📜 Found Verses</span>
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
            <div className="text-sm text-blue-800 font-medium mb-3">
              {message.content}
            </div>
            
            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div key={result.id} className="bg-white p-3 rounded border border-blue-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-blue-600">
                        {result.bookContext || result.title || 'Verse'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(result.relevance * 100).toFixed(1)}% match
                      </span>
                    </div>
                    {result.source && (
                      <div className="text-xs text-gray-600 mb-2">
                        Source: {result.source}
                      </div>
                    )}
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {result.content || result.title || 'No content available'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // User messages
  if (message.messageType === 'user') {
    return (
      <div className="flex gap-4 py-6 px-4">
        <div className="flex-1 space-y-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">You</span>
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="text-gray-700">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages
  return (
    <div className="flex gap-4 py-6 px-4">
      <div className="flex-1 space-y-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Assistant</span>
          <span className="text-xs text-gray-400">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="text-gray-700 prose prose-sm max-w-none">
          {isStreaming && !message.content && (
            <span className="text-gray-400">...</span>
          )}
          {!isStreaming && message.content && (
            <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
          )}
          {isStreaming && message.content && (
            <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentChatMessage;

