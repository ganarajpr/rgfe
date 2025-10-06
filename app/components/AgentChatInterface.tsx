'use client';

import { useState, useRef, useEffect } from 'react';
import AgentChatMessage from './AgentChatMessage';
import { AgentMessage, AgentRole } from '../lib/agents/types';
import { exportConversationToPDF } from '../lib/pdf-export';

interface AgentChatInterfaceProps {
  onSendMessage: (message: string) => Promise<void>;
  messages: AgentMessage[];
  isProcessing: boolean;
  currentAgent: AgentRole | null;
  onNewChat: () => void;
  onClearCache?: () => Promise<void>;
  modelName?: string;
}

const AgentChatInterface = ({
  onSendMessage,
  messages,
  isProcessing,
  currentAgent,
  onNewChat,
  onClearCache,
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

  const handleDownloadPDF = async () => {
    try {
      await exportConversationToPDF(messages, {
        title: 'Sanskrit Assistant Conversation',
        watermark: 'indhic.com',
        includeMetadata: true
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const getAgentStatusText = () => {
    if (!currentAgent || !isProcessing) return null;

    const agentInfo = {
      orchestrator: { label: 'Analyzing' },
      searcher: { label: 'Searching' },
      generator: { label: 'Generating' },
    };

    const info = agentInfo[currentAgent];
    
    return (
      <span className="text-xs text-gray-400">{info.label}...</span>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-semibold text-gray-700">Sanskrit Assistant</h1>
            <div className="flex items-center gap-2">
              {modelName && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{modelName}</span>
                  {onClearCache && (
                    <button
                      onClick={onClearCache}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      title="Clear model cache"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              )}
              {getAgentStatusText()}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleDownloadPDF}
              className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
              title="Download conversation as PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
          )}
          <button
            onClick={onNewChat}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            New Chat
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="max-w-2xl text-center space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-600 mb-2">
                  Sanskrit Assistant
                </h2>
                <p className="text-gray-500">
                  Ask about Sanskrit literature, texts, philosophy, and teachings
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
                {[
                  { text: 'Explain a Sanskrit text', action: 'Explain the concept of Dharma in the Bhagavad Gita' },
                  { text: 'Discuss philosophy', action: 'What are the main schools of Hindu philosophy?' },
                  { text: 'Explore ancient texts', action: 'Tell me about the Upanishads' },
                  { text: 'Learn about epics', action: 'Summarize the story of the Mahabharata' },
                ].map((suggestion) => (
                  <button
                    key={suggestion.action}
                    onClick={() => setInput(suggestion.action)}
                    className="p-4 text-left border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="text-sm text-gray-600">
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

