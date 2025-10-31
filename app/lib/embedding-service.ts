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
      env.allowLocalModels = true;
      env.allowRemoteModels = true;

      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔧 INITIALIZING EMBEDDING MODEL');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Model: ${this.config.modelId}`);
      console.log(`Target Dimension: ${this.config.dimension}`);
      console.log(`Quantization: ${this.config.quantization}`);
      console.log('───────────────────────────────────────────────────────────');
      
      // Report initial progress
      if (progressCallback) {
        progressCallback(0, 'Loading tokenizer...');
      }
      
      // Load the tokenizer
      console.log('📦 Loading tokenizer...');
      this.tokenizer = await AutoTokenizer.from_pretrained(this.config.modelId);
      console.log('✅ Tokenizer loaded');
      
      if (progressCallback) {
        progressCallback(30, 'Loading model weights...');
      }
      
      // Load the model with quantization
      console.log('📦 Loading model weights...');
      this.model = await AutoModel.from_pretrained(this.config.modelId, {
        dtype: this.config.quantization,
      });
      console.log('✅ Model weights loaded');
      
      if (progressCallback) {
        progressCallback(100, 'Model ready');
      }

      this.isInitialized = true;
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ EMBEDDING MODEL INITIALIZED SUCCESSFULLY');
      console.log('═══════════════════════════════════════════════════════════\n');
    } catch (error) {
      console.error('❌ Failed to initialize embedding model:', error);
      this.initializationPromise = null;
      throw error;
    }
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
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🧮 GENERATING EMBEDDING');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Query: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
      console.log('───────────────────────────────────────────────────────────');
      
      const startTime = performance.now();
      
      // Add the required prefix for query embeddings
      // EmbeddingGemma requires specific prefixes for optimal performance
      const prefixedQuery = "task: search result | query: " + text;
      
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
      
      // Add the required prefix for query embeddings
      const prefixedTexts = texts.map(text => "task: search result | query: " + text);
      
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
 * Using custom Rgveda-trained EmbeddingGemma model
 * - Model runs entirely in the browser using Transformers.js
 * - Fine-tuned for Rgveda Sanskrit text
 * - Supports 512 dimensions with Matryoshka Representation Learning (MRL)
 * - Uses q8 quantization (~150MB, better quality than q4)
 * - State-of-the-art performance for Sanskrit semantic search
 * 
 * Model: https://huggingface.co/Ganaraj/rgveda-gemma-onnx
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingServiceConfig = {
  modelId: 'Ganaraj/rgveda-gemma-onnx',
  dimension: 512, // Truncate to 512d (matches the binary index)
  quantization: 'q8', // Use q8 quantization (~150MB, better quality than q4)
};

export { EmbeddingService };

