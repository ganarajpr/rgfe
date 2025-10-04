'use client';

import { useState, useRef, useEffect } from 'react';
import AgentChatMessage from './AgentChatMessage';
import { AgentMessage, AgentRole } from '../lib/agents/types';

interface AgentChatInterfaceProps {
  onSendMessage: (message: string) => Promise<void>;
  messages: AgentMessage[];
  isProcessing: boolean;
  currentAgent: AgentRole | null;
  onNewChat: () => void;
  modelName?: string;
}

const AgentChatInterface = ({
  onSendMessage,
  messages,
  isProcessing,
  currentAgent,
  onNewChat,
  modelName,
}: AgentChatInterfaceProps) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const message = input.trim();
    setInput('');
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getAgentStatusBadge = () => {
    if (!currentAgent || !isProcessing) return null;

    const agentInfo = {
      orchestrator: { label: 'Analyzing', color: 'bg-purple-100 text-purple-700', icon: '🤖' },
      searcher: { label: 'Searching', color: 'bg-blue-100 text-blue-700', icon: '🔍' },
      generator: { label: 'Generating', color: 'bg-green-100 text-green-700', icon: '📝' },
    };

    const info = agentInfo[currentAgent];
    
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${info.color}`}>
        <span>{info.icon}</span>
        <span>{info.label}</span>
        <div className="flex gap-0.5">
          <div className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Sanskrit Assistant</h1>
            <div className="flex items-center gap-2">
              {modelName && (
                <p className="text-xs text-gray-500">{modelName}</p>
              )}
              {getAgentStatusBadge()}
            </div>
          </div>
        </div>
        
        <button
          onClick={onNewChat}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          New Chat
        </button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="max-w-2xl text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome to Sanskrit Assistant
                </h2>
                <p className="text-gray-600">
                  Ask me anything about Sanskrit literature, texts, philosophy, and teachings.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Powered by a multi-agent system for comprehensive answers
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
                {[
                  { icon: '📖', text: 'Explain a Sanskrit text', action: 'Explain the concept of Dharma in the Bhagavad Gita' },
                  { icon: '🕉️', text: 'Discuss philosophy', action: 'What are the main schools of Hindu philosophy?' },
                  { icon: '📜', text: 'Explore ancient texts', action: 'Tell me about the Upanishads' },
                  { icon: '🎭', text: 'Learn about epics', action: 'Summarize the story of the Mahabharata' },
                ].map((suggestion) => (
                  <button
                    key={suggestion.action}
                    onClick={() => setInput(suggestion.action)}
                    className="p-4 text-left rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-2xl mb-2">{suggestion.icon}</div>
                    <div className="text-sm font-medium text-gray-900">
                      {suggestion.text}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {messages.map((message) => (
              <AgentChatMessage
                key={message.id}
                message={message}
                isStreaming={isProcessing && message.messageType === 'assistant' && !message.content}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Sanskrit literature..."
                disabled={isProcessing}
                rows={1}
                className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
              title="Send message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Press Enter to send, Shift + Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
};

export default AgentChatInterface;

