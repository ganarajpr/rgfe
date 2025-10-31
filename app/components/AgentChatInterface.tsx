'use client';

import { useState, useRef, useEffect } from 'react';
import AgentChatMessage from './AgentChatMessage';
import { AgentMessage, AgentRole } from '../lib/agents/types';
import { getAssetPath } from '../lib/paths';

interface AgentChatInterfaceProps {
  onSendMessage: (message: string) => Promise<void>;
  messages: AgentMessage[];
  isProcessing: boolean;
  currentAgent: AgentRole | null;
  onNewChat: () => void;
  onClearCache?: () => Promise<void>;
  modelName?: string;
  onStop?: () => void;
}

const AgentChatInterface = ({
  onSendMessage,
  messages,
  isProcessing,
  currentAgent,
  onNewChat,
  onClearCache,
  modelName,
  onStop,
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

  const handlePrint = async () => {
    // First, expand all collapsed verses in the DOM
    const chatContainer = document.getElementById('chat-messages-container');
    if (chatContainer) {
      const collapsedVerses = chatContainer.querySelectorAll('button.w-full');
      const expandedStates: boolean[] = [];
      
      collapsedVerses.forEach((button, index) => {
        const parent = button.closest('div[class*="border rounded-lg"]');
        if (parent) {
          const content = parent.querySelector('div.p-4.space-y-4');
          expandedStates[index] = content !== null;
          
          // If not expanded, click to expand
          if (!content) {
            (button as HTMLButtonElement).click();
          }
        }
      });
    }

    const printStyles = `
      @media print {
        @page {
          size: A4;
          margin: 1.5cm;
        }

        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body * {
          visibility: hidden;
        }

        #chat-messages-container, #chat-messages-container * {
          visibility: visible;
        }

        #chat-messages-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          overflow: visible !important;
          height: auto !important;
        }

        header, form, button, .message-timestamp, svg {
          display: none !important;
        }

        .verse-card, .agent-chat-message {
          page-break-inside: avoid;
        }
      }
    `;
    
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = printStyles;
    document.head.appendChild(styleSheet);

    // Wait for all fonts to be fully loaded
    try {
      await document.fonts.ready;
      
      // Additional small delay to ensure rendering is complete
      setTimeout(() => {
        window.print();
        // Clean up the stylesheet after printing
        setTimeout(() => {
          document.head.removeChild(styleSheet);
        }, 100);
      }, 300);
    } catch (error) {
      console.error('Error loading fonts:', error);
      // Fallback: print anyway
      window.print();
      setTimeout(() => {
        document.head.removeChild(styleSheet);
      }, 100);
    }
  };

  const getAgentStatusText = () => {
    if (!currentAgent || !isProcessing) return null;

    const agentInfo = {
      orchestrator: { label: 'Analyzing' },
      searcher: { label: 'Searching' },
      analyzer: { label: 'Analyzing Results' },
      translator: { label: 'Translating' },
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img 
              src={getAssetPath("/ai_icon.png")} 
              alt="Rgveda Jnata" 
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="font-semibold text-gray-700">Rgveda Jnata</h1>
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
        </div>
        
        <div className="flex items-center gap-2">
          {isProcessing && onStop && (
            <button
              onClick={onStop}
              className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors rounded-md"
              title="Stop current operation"
            >
              Stop
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handlePrint}
              className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
              title="Print conversation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm7-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          )}
          <button
            onClick={onNewChat}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 8l8 8M16 8l-8 8" />
            </svg>
            New Chat
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div id="chat-messages-container" className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full px-4">
            <div className="max-w-3xl text-center space-y-8">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-gray-700">
                  Rgveda Jnata
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Ask about the Rgveda - hymns, verses, deities, rituals, and teachings. 
                  Get structured answers with beautiful verse displays.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
                {[
                  { text: 'Explore hymns', action: 'Tell me about hymns to Agni in the Rgveda', icon: '🔥' },
                  { text: 'Learn about deities', action: 'Who is Indra in the Rgveda?', icon: '⚡' },
                  { text: 'Understand rituals', action: 'What is the significance of Soma in Vedic rituals?', icon: '🍃' },
                  { text: 'Discover philosophy', action: 'What is the Nasadiya Sukta about?', icon: '🌟' },
                ].map((suggestion) => (
                  <button
                    key={suggestion.action}
                    onClick={() => setInput(suggestion.action)}
                    className="p-6 text-left border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 rounded-lg bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{suggestion.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-700">
                          {suggestion.text}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Click to explore
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
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
      <div className="border-t border-gray-200 bg-white px-4 py-6">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
          <div className="relative flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the Rgveda..."
                disabled={isProcessing}
                rows={1}
                className="w-full px-5 py-4 pr-12 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="p-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0 shadow-sm"
              title="Send message"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            Press Enter to send, Shift + Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
};

export default AgentChatInterface;

