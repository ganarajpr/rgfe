import pako from 'pako';
import { getAssetPath } from './paths';

/**
 * Binary persistence utility for Orama (Browser version)
 * Loads data from a compressed binary format for better performance and smaller file sizes
 */

export interface DocumentWithEmbedding {
  id: string;
  text?: string; // Make optional to handle null/undefined cases
  book?: string; // Make optional to handle null/undefined cases
  bookContext?: string; // Make optional to handle null/undefined cases
  embedding: number[];
}

/**
 * Convert binary buffer to embedding array
 * @param buffer - Binary buffer (Uint8Array)
 * @returns Embedding vector
 */
function bufferToEmbedding(buffer: Uint8Array): number[] {
  const embedding: number[] = [];
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  
  for (let i = 0; i < buffer.length; i += 4) {
    embedding.push(view.getFloat32(i, true)); // true for little-endian
  }
  
  return embedding;
}

/**
 * Load Orama data from binary file (browser version)
 * @param filePath - Path to load the data from (relative to public directory)
 * @returns Array of documents with embeddings
 */
export async function loadOramaDataBinary(filePath: string): Promise<DocumentWithEmbedding[]> {
  try {
    // Use getAssetPath to handle basePath for GitHub Pages
    const assetPath = getAssetPath(filePath);
    console.log(`Loading Orama data from binary format: ${assetPath}...`);
    
    // Fetch the binary file from the public directory
    const response = await fetch(assetPath);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch binary data file: ${assetPath} (${response.status})`);
    }
    
    // Read the compressed data
    const compressedData = await response.arrayBuffer();
    const compressedBuffer = new Uint8Array(compressedData);
    
    // Decompress using pako
    const decompressedBuffer = pako.ungzip(compressedBuffer);
    
    // Ensure we have a proper Uint8Array
    if (!(decompressedBuffer instanceof Uint8Array)) {
      throw new Error('Decompressed data is not a Uint8Array');
    }
    
    let offset = 0;
    
    // Read header length
    const headerLength = new DataView(decompressedBuffer.buffer).getUint32(offset, true);
    offset += 4;
    
    // Read header
    const headerBuffer = decompressedBuffer.slice(offset, offset + headerLength);
    const headerText = new TextDecoder('utf-8').decode(headerBuffer);
    const header = JSON.parse(headerText);
    offset += headerLength;
    
    // Read document count
    const dataView = new DataView(decompressedBuffer.buffer);
    const documentCount = dataView.getUint32(offset, true);
    offset += 4;
    
    // Read total size (skip it, we don't need it for reading)
    offset += 4;
    
    console.log(`   Header: ${header.format}, ${documentCount} documents from binary`);
    
    // Read documents
    const documents: DocumentWithEmbedding[] = [];
    const decoder = new TextDecoder('utf-8');
    
    for (let i = 0; i < documentCount; i++) {
      // Read id length and id
      const idLength = dataView.getUint32(offset, true);
      offset += 4;
      const id = decoder.decode(decompressedBuffer.slice(offset, offset + idLength));
      offset += idLength;
      
      // Read text length and text
      const textLength = dataView.getUint32(offset, true);
      offset += 4;
      const text = decoder.decode(decompressedBuffer.slice(offset, offset + textLength));
      offset += textLength;
      
      // Read book length and book
      const bookLength = dataView.getUint32(offset, true);
      offset += 4;
      const book = decoder.decode(decompressedBuffer.slice(offset, offset + bookLength));
      offset += bookLength;
      
      // Read bookContext length and bookContext
      const bookContextLength = dataView.getUint32(offset, true);
      offset += 4;
      const bookContext = decoder.decode(decompressedBuffer.slice(offset, offset + bookContextLength));
      offset += bookContextLength;
      
      // Read embedding length and embedding
      const embeddingLength = dataView.getUint32(offset, true);
      offset += 4;
      const embeddingBuffer = decompressedBuffer.slice(offset, offset + embeddingLength);
      const embedding = bufferToEmbedding(embeddingBuffer);
      offset += embeddingLength;
      
      documents.push({
        id,
        text,
        book,
        bookContext,
        embedding
      });
    }
    
    console.log(`✅ Binary data loaded successfully: ${documents.length} documents`);
    return documents;
  } catch (error) {
    console.error('Error loading binary Orama data:', error);
    throw error;
  }
}

