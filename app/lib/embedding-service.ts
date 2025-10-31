/**
 * Embedding Service using EmbeddingGemma with Transformers.js
 * Generates embeddings for text queries using Google's EmbeddingGemma model
 * 
 * Based on: https://glaforge.dev/posts/2025/09/08/in-browser-semantic-search-with-embeddinggemma/
 * Model: https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX
 */

export interface EmbeddingServiceConfig {
  modelId: string;
  dimension: number;
  quantization?: 'q4' | 'q8' | 'fp16' | 'fp32' | 'int8' | 'uint8' | 'bnb4' | 'q4f16' | 'auto';
}

class EmbeddingService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tokenizer: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private readonly config: EmbeddingServiceConfig;

  constructor(config: EmbeddingServiceConfig) {
    this.config = {
      quantization: 'q4', // Default to q4 quantization for efficiency
      ...config,
    };
  }

  /**
   * Initialize the embedding model
   */
  async initialize(progressCallback?: (progress: number, message: string) => void): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized && this.tokenizer && this.model) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this._initializeInternal(progressCallback);
    await this.initializationPromise;
  }

  private async _initializeInternal(progressCallback?: (progress: number, message: string) => void): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        throw new Error('EmbeddingService can only be initialized in the browser');
      }

      // Dynamically import heavy transformers library on client only
      const { AutoTokenizer, AutoModel, env } = await import('@huggingface/transformers');
      
      // Configure Transformers.js environment
      // Models will be downloaded from Hugging Face CDN and cached in browser
      env.allowRemoteModels = true;  // Enable downloading from Hugging Face
      env.allowLocalModels = false;  // Disable local file:// paths (only use HF CDN)
      
      // Force cache refresh to get the updated model structure
      env.cacheDir = '.transformers_cache';

      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔧 INITIALIZING EMBEDDING MODEL');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Model: ${this.config.modelId}`);
      console.log(`Source: Hugging Face CDN (https://huggingface.co/${this.config.modelId})`);
      console.log(`Target Dimension: ${this.config.dimension}`);
      console.log('───────────────────────────────────────────────────────────');
      
      // Report initial progress (values should be between 0-1)
      if (progressCallback) {
        progressCallback(0, 'Loading tokenizer...');
      }
      
      // Load the tokenizer
      console.log('📦 Loading tokenizer...');
      this.tokenizer = await AutoTokenizer.from_pretrained(this.config.modelId);
      console.log('✅ Tokenizer loaded');
      
      if (progressCallback) {
        progressCallback(0.3, 'Loading model weights...');
      }
      
      // Load the model (updated structure on Hugging Face)
      console.log('📦 Loading model weights...');
      const modelOptions: Record<string, unknown> = {};
      if (this.config.quantization) {
        modelOptions.dtype = this.config.quantization;
        console.log(`   Using quantization: ${this.config.quantization}`);
      }
      this.model = await AutoModel.from_pretrained(this.config.modelId, modelOptions);
      console.log('✅ Model weights loaded');
      
      if (progressCallback) {
        progressCallback(1.0, 'Model ready');
      }

      this.isInitialized = true;
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ EMBEDDING MODEL INITIALIZED SUCCESSFULLY');
      console.log('   Model structure has been updated on Hugging Face');
      console.log('═══════════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('❌ Failed to initialize embedding model:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Enhance query text to be more descriptive for better embedding matching
   * The embedding model was trained on longer, descriptive queries like:
   * "Description of Agni as the chief Hotṛ priest."
   * So we should expand short queries into longer, descriptive ones
   */
  private enhanceQueryForEmbedding(text: string): string {
    // If the query is already long and descriptive (more than 30 chars), use it as-is
    if (text.length > 30) {
      return text;
    }

    // For short queries, expand them into more descriptive formats
    // Match the training data format: "Description of [topic]..."
    const trimmed = text.trim();
    
    // Check if it's already in a descriptive format
    if (trimmed.toLowerCase().startsWith('description of') ||
        trimmed.toLowerCase().startsWith('verse about') ||
        trimmed.toLowerCase().startsWith('hymn') ||
        trimmed.toLowerCase().startsWith('passage') ||
        trimmed.toLowerCase().startsWith('text') ||
        trimmed.toLowerCase().startsWith('verse calling') ||
        trimmed.toLowerCase().startsWith('verse describing')) {
      return text;
    }

    // Expand short queries to descriptive format
    // Example: "Agni" -> "Description of Agni as a deity in RigVeda"
    // Example: "fire sacrifice" -> "Description of fire sacrifice ritual in RigVeda"
    // Example: "10.129" -> "Verses from hymn 10.129 in RigVeda"
    
    // Check if it's a verse reference (contains numbers and dots)
    if (/^\d+\.\d+/.test(trimmed)) {
      return `Verses from hymn ${trimmed} in RigVeda`;
    }
    
    // For other short queries, expand them descriptively
    return `Description of ${trimmed} in RigVeda`;
  }

  /**
   * Generate embedding for a text query
   * @param text - The text to generate embedding for
   * @returns Embedding vector (truncated to configured dimension)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized || !this.tokenizer || !this.model) {
      await this.initialize();
    }

    if (!this.tokenizer || !this.model) {
      throw new Error('Embedding model is not properly initialized');
    }

    try {
      // Enhance the query to be more descriptive (match training data format)
      const enhancedQuery = this.enhanceQueryForEmbedding(text);
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🧮 GENERATING EMBEDDING');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Original Query: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
      console.log(`Enhanced Query: "${enhancedQuery.substring(0, 100)}${enhancedQuery.length > 100 ? '...' : ''}"`);
      console.log('───────────────────────────────────────────────────────────');
      
      const startTime = performance.now();
      
      // Add the required prefix for query embeddings
      // EmbeddingGemma requires specific prefixes for optimal performance
      const prefixedQuery = "task: search result | query: " + enhancedQuery;
      
      console.log('🔤 Tokenizing input...');
      
      // Tokenize the input
      const inputs = await this.tokenizer(prefixedQuery, {
        padding: true,
        truncation: true,
      });
      
      console.log('🤖 Running model inference...');
      
      // Get the sentence embedding
      const { sentence_embedding } = await this.model(inputs);
      
      // Convert to JavaScript array
      const embeddingArray = sentence_embedding.tolist() as number[][];
      const fullEmbedding = embeddingArray[0];
      
      // Truncate to configured dimension using Matryoshka Representation Learning
      // EmbeddingGemma supports truncation with minimal loss in quality
      const truncatedEmbedding = fullEmbedding.slice(0, this.config.dimension);
      
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      
      // Calculate vector norm for debugging
      const norm = Math.sqrt(truncatedEmbedding.reduce((sum, v) => sum + v * v, 0));
      
      console.log('📊 EMBEDDING GENERATED');
      console.log('───────────────────────────────────────────────────────────');
      console.log(`   - Full dimension: ${fullEmbedding.length}`);
      console.log(`   - Truncated dimension: ${truncatedEmbedding.length}`);
      console.log(`   - Time: ${duration}ms`);
      console.log(`   - First 5 values: [${truncatedEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      console.log(`   - Vector norm: ${norm.toFixed(4)}`);
      console.log('═══════════════════════════════════════════════════════════\n');

      return truncatedEmbedding;
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   * @param texts - Array of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.isInitialized || !this.tokenizer || !this.model) {
      await this.initialize();
    }

    if (!this.tokenizer || !this.model) {
      throw new Error('Embedding model is not properly initialized');
    }

    try {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🧮 GENERATING MULTIPLE EMBEDDINGS');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Number of texts: ${texts.length}`);
      console.log('───────────────────────────────────────────────────────────');
      
      const startTime = performance.now();
      
      // Enhance queries to be more descriptive (match training data format)
      const enhancedTexts = texts.map(text => this.enhanceQueryForEmbedding(text));
      
      // Add the required prefix for query embeddings
      const prefixedTexts = enhancedTexts.map(text => "task: search result | query: " + text);
      
      console.log('🔤 Tokenizing inputs...');
      
      // Tokenize all inputs
      const inputs = await this.tokenizer(prefixedTexts, {
        padding: true,
        truncation: true,
      });
      
      console.log('🤖 Running model inference...');
      
      // Get the sentence embeddings
      const { sentence_embedding } = await this.model(inputs);
      
      // Convert to JavaScript arrays and truncate
      const embeddingArrays = sentence_embedding.tolist() as number[][];
      const truncatedEmbeddings = embeddingArrays.map(embedding => 
        embedding.slice(0, this.config.dimension)
      );
      
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      
      console.log('📊 EMBEDDINGS GENERATED');
      console.log('───────────────────────────────────────────────────────────');
      console.log(`   - Count: ${truncatedEmbeddings.length}`);
      console.log(`   - Dimension: ${truncatedEmbeddings[0].length}`);
      console.log(`   - Total time: ${duration}ms`);
      console.log(`   - Average time per text: ${(parseFloat(duration) / texts.length).toFixed(2)}ms`);
      console.log('═══════════════════════════════════════════════════════════\n');

      return truncatedEmbeddings;
    } catch (error) {
      console.error('❌ Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Check if the embedding model is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.tokenizer !== null && this.model !== null;
  }

  /**
   * Get the embedding dimension
   */
  getDimension(): number {
    return this.config.dimension;
  }

  /**
   * Get the model ID
   */
  getModelId(): string {
    return this.config.modelId;
  }

  /**
   * Unload the embedding model and free memory
   */
  async unload(): Promise<void> {
    if (this.tokenizer || this.model) {
      try {
        console.log('🧹 Unloading embedding model from memory...');
        
        // Dispose of model resources if the library supports it
        if (this.model && typeof this.model.dispose === 'function') {
          await this.model.dispose();
        }
        
        this.tokenizer = null;
        this.model = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        
        console.log('✅ Embedding model unloaded successfully');
      } catch (error) {
        console.error('❌ Error unloading embedding model:', error);
        // Clear references even on error to prevent memory leaks
        this.tokenizer = null;
        this.model = null;
        this.isInitialized = false;
        this.initializationPromise = null;
      }
    }
  }
}

// Export a singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * Get the embedding service instance
 * @param config - Configuration for the embedding service (required on first call)
 */
export function getEmbeddingService(config?: EmbeddingServiceConfig): EmbeddingService {
  if (!embeddingServiceInstance && config) {
    embeddingServiceInstance = new EmbeddingService(config);
  }
  
  if (!embeddingServiceInstance) {
    throw new Error('Embedding service not initialized. Provide config on first call.');
  }
  
  return embeddingServiceInstance;
}

/**
 * Default embedding model configuration
 * 
 * Using fine-tuned RigVeda EmbeddingGemma ONNX model
 * - Model runs entirely in the browser using Transformers.js
 * - Fine-tuned on RigVeda Sanskrit corpus for improved semantic search
 * - Outputs 768 dimensions (full) but truncated to 512d to match binary index
 * - Uses Matryoshka Representation Learning (MRL) for efficient truncation
 * - Optimized specifically for RigVeda Sanskrit text embeddings
 * - Quantized versions available (q4, q8, fp16, fp32)
 * 
 * Model: https://huggingface.co/Ganaraj/rgveda-gemma-onnx
 * Base Model: google/embeddinggemma-300m
 * Fine-tuned: 51,368 Sanskrit samples from RigVeda corpus
 * Training: Sentence Transformers with MultipleNegativesRankingLoss
 * Accuracy: 95.53% on test set (cosine similarity)
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingServiceConfig = {
  modelId: 'Ganaraj/rgveda-gemma-onnx',
  dimension: 512, // Truncate to 512d (matches the binary index)
  quantization: 'q8', // Use q8 quantization (~150MB, better quality than q4)
};

export { EmbeddingService };

