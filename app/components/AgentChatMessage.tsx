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
      <div className="flex gap-3 py-3 px-4 mx-auto max-w-4xl">
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-2 border border-blue-200 dark:border-blue-800">
          <div className="flex-shrink-0">
            {message.messageType === 'thinking' ? (
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
              </div>
            ) : (
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <span className="font-medium">{message.content}</span>
        </div>
      </div>
    );
  }

  // User messages
  if (message.messageType === 'user') {
    return (
      <div className="flex gap-4 py-6 px-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">You</span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          
          <div className="text-gray-800 dark:text-gray-200">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages
  return (
    <div className="flex gap-4 py-6 px-4 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">Sanskrit Scholar AI</span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="text-gray-800 dark:text-gray-200 prose prose-sm dark:prose-invert max-w-none">
          {isStreaming && !message.content && (
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
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

