'use client';

import { useEffect, useState } from 'react';
import * as webllm from '@mlc-ai/web-llm';

export type ProviderType = 'gemini' | 'webllm';

export interface ModelSelection {
  provider: ProviderType;
  modelId: string;
  apiKey?: string;
}

interface LLMSelectorProps {
  onSelectModel: (selection: ModelSelection) => void;
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
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('gemini');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [selectedWebLLMModel, setSelectedWebLLMModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<Model[]>([
    {
      id: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
      name: 'Mistral 7B Instruct v0.3',
      size: '4.2GB',
      description: 'High-quality reasoning and instruction following',
      recommended: true,
    },
  ]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('🔑 Gemini API Key state:', geminiApiKey ? `${geminiApiKey.length} chars` : 'empty');
  }, [geminiApiKey]);

  useEffect(() => {
    const loadPrebuiltModels = () => {
      try {
        // WebLLM exposes a prebuilt app config with model_list
        const prebuilt = (webllm as unknown as { prebuiltAppConfig?: unknown }).prebuiltAppConfig;
        
        type ModelListItem = {
          model_id?: string;
          model?: string;
        };
        
        let modelList: ModelListItem[] | undefined;

        if (typeof prebuilt === 'function') {
          const cfg = prebuilt();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          modelList = (cfg as any)?.model_list as ModelListItem[];
        } else if (prebuilt && typeof prebuilt === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          modelList = (prebuilt as any).model_list as ModelListItem[];
        }

        if (Array.isArray(modelList) && modelList.length > 0) {
          // Filter for Mistral models
          const mistralModels = modelList.filter((m) => {
            const id: string = m.model_id || m.model || '';
            return id.toLowerCase().includes('mistral');
          });

          if (mistralModels.length > 0) {
            const mapped: Model[] = mistralModels
              .map((m) => {
                const id: string = m.model_id || m.model || '';
                if (!id) return null;
                return {
                  id,
                  name: id.replace('-MLC', '').replace(/-/g, ' '),
                  size: '—',
                  description: 'Mistral model from WebLLM',
                  recommended: id.includes('7B'),
                } as Model;
              })
              .filter(Boolean) as Model[];

            const seen = new Set<string>();
            const deduped = mapped.filter((m) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            }).sort((a, b) => a.name.localeCompare(b.name));

            if (deduped.length > 0) {
              setAvailableModels(deduped);
              // Set the first recommended model as default
              const recommended = deduped.find(m => m.recommended);
              if (recommended) {
                setSelectedWebLLMModel(recommended.id);
              }
            }
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        console.warn('Failed to load WebLLM prebuilt model list, using defaults:', err);
        setSelectedWebLLMModel('Mistral-7B-Instruct-v0.3-q4f32_1-MLC');
      }
    };

    loadPrebuiltModels();
    
    // Load saved Gemini API key from localStorage
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      setGeminiApiKey(savedApiKey);
    }
  }, []);

  const handleSubmit = () => {
    if (selectedProvider === 'gemini') {
      if (!geminiApiKey || geminiApiKey.trim().length < 20) {
        alert('Please enter a valid Gemini API key');
        return;
      }
      // Save API key to localStorage
      localStorage.setItem('gemini_api_key', geminiApiKey.trim());
      onSelectModel({
        provider: 'gemini',
        modelId: 'gemini-2.5-flash',
        apiKey: geminiApiKey.trim(),
      });
    } else {
      if (!selectedWebLLMModel) {
        alert('Please select a WebLLM model');
        return;
      }
      onSelectModel({
        provider: 'webllm',
        modelId: selectedWebLLMModel,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">
            Select AI Provider
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Choose your preferred AI provider to power the chat experience.
          </p>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            {/* Gemini Option */}
            <div
              className={`border-2 rounded-xl p-4 transition-all duration-200 ${
                selectedProvider === 'gemini'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <button
                onClick={() => setSelectedProvider('gemini')}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedProvider === 'gemini'
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedProvider === 'gemini' && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      Google Gemini
                    </h3>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      Recommended
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 ml-7 mb-3">
                  Use Google&apos;s powerful Gemini 2.5 Flash model with your API key. Fast, accurate, and cloud-based.
                </p>
              </button>
              
              {selectedProvider === 'gemini' && (
                <div className="ml-7 mt-3 space-y-2">
                  <label htmlFor="gemini-api-key" className="block text-sm font-medium text-gray-700">
                    Gemini API Key {geminiApiKey && `(${geminiApiKey.length} characters)`}
                  </label>
                  <div className="relative flex gap-2">
                    <input
                      id="gemini-api-key"
                      type="text"
                      value={geminiApiKey}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log('📝 onChange fired:', newValue.length, 'characters');
                        setGeminiApiKey(newValue);
                      }}
                      onInput={(e) => {
                        const newValue = (e.target as HTMLInputElement).value;
                        console.log('⌨️ onInput fired:', newValue.length, 'characters');
                        setGeminiApiKey(newValue);
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text');
                        console.log('📋 Paste detected:', pastedText.length, 'characters');
                        setGeminiApiKey(pastedText.trim());
                      }}
                      placeholder="Paste your Gemini API key (starts with AIza...)"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          console.log('📋 Clipboard button clicked:', text.length, 'characters');
                          setGeminiApiKey(text.trim());
                        } catch (err) {
                          console.error('Failed to read clipboard:', err);
                          alert('Failed to read clipboard. Please paste manually (Ctrl+V or Cmd+V)');
                        }
                      }}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                      title="Paste from clipboard"
                    >
                      📋 Paste
                    </button>
                    {geminiApiKey && geminiApiKey.length >= 20 && (
                      <div className="absolute right-20 top-1/2 -translate-y-1/2">
                        <span className="text-green-600 font-bold">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Get your API key from{' '}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Google AI Studio
                      </a>
                    </p>
                    {geminiApiKey && (
                      <span className={`text-xs font-medium ${
                        geminiApiKey.length >= 20 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {geminiApiKey.length >= 20 ? 'Valid ✓' : `Need ${20 - geminiApiKey.length} more characters`}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* WebLLM Option */}
            <div
              className={`border-2 rounded-xl p-4 transition-all duration-200 ${
                selectedProvider === 'webllm'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <button
                onClick={() => setSelectedProvider('webllm')}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedProvider === 'webllm'
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedProvider === 'webllm' && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      Mistral (WebLLM)
                    </h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                      No API Key Required
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 ml-7 mb-3">
                  Run Mistral models locally in your browser. Private and doesn&apos;t require an API key.
                </p>
              </button>
              
              {selectedProvider === 'webllm' && (
                <div className="ml-7 mt-3 space-y-2">
                  <div className="block text-sm font-medium text-gray-700 mb-2">
                    Select Model
                  </div>
                  <div className="space-y-2">
                    {availableModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => setSelectedWebLLMModel(model.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                          selectedWebLLMModel === model.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900 text-sm">
                              {model.name}
                            </h4>
                            <p className="text-xs text-gray-600 mt-1">
                              {model.description}
                            </p>
                          </div>
                          {model.size !== '—' && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              {model.size}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Note: The model will be downloaded and cached in your browser (~4-5GB).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleSubmit}
            disabled={
              (selectedProvider === 'gemini' && (!geminiApiKey || geminiApiKey.trim().length < 20)) ||
              (selectedProvider === 'webllm' && !selectedWebLLMModel)
            }
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              ((selectedProvider === 'gemini' && geminiApiKey && geminiApiKey.trim().length >= 20) ||
              (selectedProvider === 'webllm' && selectedWebLLMModel))
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
            }`}
          >
            {selectedProvider === 'gemini' ? 'Connect to Gemini' : 'Load Model'}
          </button>
          {selectedProvider === 'gemini' && geminiApiKey && geminiApiKey.trim().length < 20 && (
            <p className="text-xs text-red-600 self-center">
              API key must be at least 20 characters
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LLMSelector;

