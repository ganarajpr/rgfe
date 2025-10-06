'use client';

import { useState } from 'react';

interface LLMSelectorProps {
  onSelectModel: (modelId: string) => void;
  isOpen: boolean;
}

interface Model {
  id: string;
  name: string;
  size: string;
  description: string;
  recommended?: boolean;
}

const LLMSelector = ({ onSelectModel, isOpen }: LLMSelectorProps) => {
  const [selectedModel, setSelectedModel] = useState<string>('');
  
  const availableModels: Model[] = [
    {
      id: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
      name: 'Mistral 7B Instruct v0.3',
      size: '4.2GB',
      description: 'Recommended - High-quality reasoning and instruction following',
      recommended: true,
    },
    {
      id: 'Qwen3-8B-q4f16_1-MLC',
      name: 'Qwen3 8B',
      size: '4.8GB',
      description: 'Best multilingual capability and reasoning',
    },
    {
      id: 'gemma-2-2b-it-q4f16_1-MLC',
      name: 'Gemma 2 2B Instruct',
      size: '1.5GB',
      description: 'Google\'s efficient small model with strong performance',
    },
    {
      id: 'Qwen3-4B-q4f16_1-MLC',
      name: 'Qwen3 4B',
      size: '2.4GB',
      description: 'Balanced performance with good multilingual support',
    },
    {
      id: 'Qwen3-0.6B-q4f16_1-MLC',
      name: 'Qwen3 0.6B',
      size: '0.4GB',
      description: 'Ultra-lightweight model for fast responses',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">
            Select a Language Model
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Choose an AI model to load in your browser. The model will be downloaded and cached locally.
          </p>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            {availableModels.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedModel === model.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {model.name}
                    </h3>
                    {model.recommended && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        Recommended
                      </span>
                    )}
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {model.size}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {model.description}
                </p>
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={() => selectedModel && onSelectModel(selectedModel)}
            disabled={!selectedModel}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              selectedModel
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Load Model
          </button>
        </div>
      </div>
    </div>
  );
};

export default LLMSelector;

