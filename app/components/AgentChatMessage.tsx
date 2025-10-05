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

