'use client';

import { useState, useRef, useEffect } from 'react';
import { Orama } from '@orama/orama';
import type { DocumentWithEmbedding } from '@/app/lib/binary-persistence';

interface SearchResult {
  id: string;
  text?: string; // Make optional to handle null/undefined cases
  book?: string; // Make optional to handle null/undefined cases
  bookContext?: string; // Make optional to handle null/undefined cases
  score: number;
}

interface ConsoleMessage {
  message: string;
  type: 'log' | 'error' | 'success';
  timestamp: string;
}

export default function TestSearchPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tokenizer, setTokenizer] = useState<any>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [model, setModel] = useState<any>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [db, setDb] = useState<Orama<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [documents, setDocuments] = useState<DocumentWithEmbedding[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [initProgress, setInitProgress] = useState('');
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  
  // Metrics
  const [initTime, setInitTime] = useState<string>('-');
  const [embeddingTime, setEmbeddingTime] = useState<string>('-');
  const [searchTime, setSearchTime] = useState<string>('-');
  const [docCount, setDocCount] = useState<string>('-');

  const consoleRef = useRef<HTMLDivElement>(null);

  // Add console message
  const addConsoleMessage = (message: string, type: 'log' | 'error' | 'success' = 'log') => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleMessages(prev => [...prev, { message, type, timestamp }]);
  };

  // Scroll console to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleMessages]);

  // Initialize system
  const initialize = async () => {
    if (isInitialized || isInitializing) return;

    setIsInitializing(true);
    setInitProgress('Initializing...');
    addConsoleMessage('🔧 Starting initialization...', 'log');

    try {
      const startTime = performance.now();

      // Dynamically import Transformers.js (client-side only)
      addConsoleMessage('📦 Loading Transformers.js library...', 'log');
      const { AutoTokenizer, AutoModel, env } = await import('@huggingface/transformers');
      
      // Configure Transformers.js
      env.allowLocalModels = true;
      env.allowRemoteModels = true;
      addConsoleMessage('✅ Transformers.js loaded', 'success');

      // Load embedding model
      setInitProgress('Loading EmbeddingGemma model...');
      addConsoleMessage('📦 Loading tokenizer from HuggingFace...', 'log');
      
      const loadedTokenizer = await AutoTokenizer.from_pretrained(
        'onnx-community/embeddinggemma-300m-ONNX'
      );
      setTokenizer(loadedTokenizer);
      addConsoleMessage('✅ Tokenizer loaded', 'success');

      addConsoleMessage('📦 Loading model weights (q4 quantization)...', 'log');
      const loadedModel = await AutoModel.from_pretrained(
        'onnx-community/embeddinggemma-300m-ONNX',
        { dtype: 'q4' }
      );
      setModel(loadedModel);
      addConsoleMessage('✅ Model weights loaded', 'success');

      // Load binary index (dynamically import to ensure client-side only)
      setInitProgress('Loading search index...');
      addConsoleMessage('📦 Loading binary index from /smrithi-rgveda-embgemma-512d.bin...', 'log');
      
      const { loadOramaDataBinary } = await import('@/app/lib/binary-persistence');
      const loadedDocs = await loadOramaDataBinary('/smrithi-rgveda-embgemma-512d.bin');
      setDocuments(loadedDocs);
      addConsoleMessage(`✅ Loaded ${loadedDocs.length} documents`, 'success');

      // Create Orama database (dynamically import)
      setInitProgress('Creating search database...');
      addConsoleMessage('🔧 Creating Orama database...', 'log');
      
      const { create, insert } = await import('@orama/orama');
      const newDb = create({
        schema: {
          id: 'string',
          text: 'string',
          book: 'string',
          bookContext: 'string',
          embedding: 'vector[512]',
        },
      });

      // Insert documents
      addConsoleMessage('📥 Inserting documents into Orama...', 'log');
      for (const doc of loadedDocs) {
        await insert(newDb, doc);
      }
      setDb(newDb);
      addConsoleMessage('✅ All documents inserted', 'success');

      const endTime = performance.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      setInitTime(`${duration}s`);
      setDocCount(loadedDocs.length.toString());
      setInitProgress('System initialized successfully!');
      addConsoleMessage(`✅ Initialization complete in ${duration}s`, 'success');
      setIsInitialized(true);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setInitProgress(`Error: ${errorMessage}`);
      addConsoleMessage(`❌ Initialization failed: ${errorMessage}`, 'error');
      console.error('Initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  // Generate embedding
  const generateEmbedding = async (text: string): Promise<number[]> => {
    if (!tokenizer || !model) {
      throw new Error('Model not initialized');
    }

    const prefixedQuery = "task: search result | query: " + text;
    
    const inputs = await tokenizer(prefixedQuery, {
      padding: true,
      truncation: true,
    });
    
    const { sentence_embedding } = await model(inputs);
    const embeddingArray = sentence_embedding.tolist() as number[][];
    const fullEmbedding = embeddingArray[0];
    
    // Truncate to 512 dimensions using MRL
    return fullEmbedding.slice(0, 512);
  };

  // Run search
  const runSearch = async () => {
    if (!query.trim() || !db || !isInitialized) return;

    setIsSearching(true);
    setResults([]);
    addConsoleMessage('═══════════════════════════════════════════════', 'log');
    addConsoleMessage(`🔍 SEMANTIC SEARCH: "${query}"`, 'log');
    addConsoleMessage('═══════════════════════════════════════════════', 'log');

    try {
      // Generate embedding
      addConsoleMessage('🧮 Generating query embedding...', 'log');
      const embStart = performance.now();
      const queryEmbedding = await generateEmbedding(query);
      const embEnd = performance.now();
      const embDuration = (embEnd - embStart).toFixed(2);
      
      setEmbeddingTime(`${embDuration}ms`);
      addConsoleMessage(`✅ Embedding generated in ${embDuration}ms`, 'success');
      addConsoleMessage(`   Dimension: ${queryEmbedding.length}`, 'log');
      addConsoleMessage(`   First 5 values: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`, 'log');

      // Perform search (dynamically import to ensure client-side only)
      addConsoleMessage('🔍 Performing vector search...', 'log');
      const searchStart = performance.now();
      const { search } = await import('@orama/orama');
      const searchResults = await search(db, {
        mode: 'vector',
        vector: {
          value: queryEmbedding,
          property: 'embedding',
        },
        limit: 10,
        includeVectors: false,
      });
      const searchEnd = performance.now();
      const searchDuration = (searchEnd - searchStart).toFixed(2);
      
      setSearchTime(`${searchDuration}ms`);
      addConsoleMessage(`✅ Search complete in ${searchDuration}ms`, 'success');
      addConsoleMessage(`   Found ${searchResults.hits.length} results`, 'success');

      // Map results
      const mappedResults: SearchResult[] = searchResults.hits.map((hit) => ({
        id: hit.document.id as string,
        text: hit.document.text as string,
        book: hit.document.book as string,
        bookContext: hit.document.bookContext as string,
        score: hit.score,
      }));

      setResults(mappedResults);
      addConsoleMessage('═══════════════════════════════════════════════', 'log');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addConsoleMessage(`❌ Search failed: ${errorMessage}`, 'error');
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isInitialized && !isSearching) {
      runSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-8">
        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-800 border-b-4 border-green-500 pb-3 mb-6">
          🔍 Semantic Search Test
        </h1>
        <p className="text-gray-600 mb-6">
          Testing EmbeddingGemma + Orama integration for in-browser semantic search
        </p>

        {/* Info Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-blue-900">
            <strong>ℹ️ Instructions:</strong> Click &quot;Initialize System&quot; to load the embedding model and search index. 
            Then enter a query and click &quot;Search&quot; to test semantic search.
          </p>
        </div>

        {/* Step 1: Initialize */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Step 1: Initialize System</h2>
          <button
            onClick={initialize}
            disabled={isInitializing || isInitialized}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {(() => {
              if (isInitializing) return '⏳ Initializing...';
              if (isInitialized) return '✅ Initialized';
              return 'Initialize System';
            })()}
          </button>
          {initProgress && (
            <div className={`mt-4 p-4 rounded-lg ${
              (() => {
                if (initProgress.includes('Error')) return 'bg-red-50 border-l-4 border-red-500';
                if (initProgress.includes('success')) return 'bg-green-50 border-l-4 border-green-500';
                return 'bg-blue-50 border-l-4 border-blue-500';
              })()
            }`}>
              <p className="font-mono text-sm">{initProgress}</p>
            </div>
          )}
        </div>

        {/* Step 2: Search */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Step 2: Run Search Query</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your search query (e.g., 'fire sacrifice ritual')"
              disabled={!isInitialized || isSearching}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:bg-gray-100"
            />
            <button
              onClick={runSearch}
              disabled={!isInitialized || isSearching || !query.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {isSearching ? '⏳ Searching...' : '🔍 Search'}
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-gray-600 text-sm mb-2">Initialization Time</div>
              <div className="text-2xl font-bold text-gray-800">{initTime}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-gray-600 text-sm mb-2">Embedding Time</div>
              <div className="text-2xl font-bold text-gray-800">{embeddingTime}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-gray-600 text-sm mb-2">Search Time</div>
              <div className="text-2xl font-bold text-gray-800">{searchTime}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-gray-600 text-sm mb-2">Total Documents</div>
              <div className="text-2xl font-bold text-gray-800">{docCount}</div>
            </div>
          </div>
        </div>

        {/* Search Results */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Search Results</h2>
          {results.length === 0 ? (
            <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
              {isInitialized ? 'No results yet. Try searching for something!' : 'Initialize the system first.'}
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result, idx) => (
                <div key={result.id} className="bg-gray-50 p-5 rounded-lg border-l-4 border-blue-500">
                  <h3 className="text-lg font-semibold text-blue-600 mb-2">Result {idx + 1}</h3>
                  <div className="text-green-600 font-bold mb-2">Score: {result.score.toFixed(4)}</div>
                  <div className="text-gray-600 text-sm mb-3">
                    Source: {result.book} - {result.bookContext}
                  </div>
                  <div className="text-gray-800 leading-relaxed">{result.text || 'No text available'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Console Output */}
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Console Output</h2>
          <div
            ref={consoleRef}
            className="bg-gray-900 text-gray-300 p-4 rounded-lg h-80 overflow-y-auto font-mono text-xs"
          >
            {consoleMessages.length === 0 ? (
              <div className="text-gray-500">Console messages will appear here...</div>
            ) : (
              consoleMessages.map((msg, idx) => {
                let colorClass = 'text-gray-300';
                if (msg.type === 'error') colorClass = 'text-red-400';
                else if (msg.type === 'success') colorClass = 'text-green-400';
                
                return (
                  <div
                    key={`${msg.timestamp}-${idx}`}
                    className={`mb-1 ${colorClass}`}
                  >
                    [{msg.timestamp}] {msg.message}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
