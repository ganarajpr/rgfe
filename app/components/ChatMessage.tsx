'use client';

import { marked } from 'marked';
import { useEffect, useState } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
}

const ChatMessage = ({ role, content, timestamp, isStreaming }: ChatMessageProps) => {
  const [renderedContent, setRenderedContent] = useState<string>('');

  useEffect(() => {
    if (role === 'assistant') {
      const parseMarkdown = async () => {
        const html = await marked.parse(content);
        setRenderedContent(html);
      };
      parseMarkdown();
    } else {
      setRenderedContent(content);
    }
  }, [content, role]);

  return (
    <div className={`flex gap-4 py-6 px-4 ${role === 'assistant' ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}>
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          role === 'user'
            ? 'bg-blue-600'
            : 'bg-gradient-to-br from-purple-500 to-pink-500'
        }`}>
          {role === 'user' ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          )}
        </div>
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">
            {role === 'user' ? 'You' : 'AI Assistant'}
          </span>
          {timestamp && (
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {timestamp.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        <div className={role === 'assistant' ? 'text-gray-800 dark:text-gray-200 prose prose-sm dark:prose-invert max-w-none' : 'text-gray-800 dark:text-gray-200'}>
          {isStreaming && (
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
          )}
          {!isStreaming && role === 'assistant' && (
            <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
          )}
          {!isStreaming && role === 'user' && (
            <p className="whitespace-pre-wrap">{content}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;

