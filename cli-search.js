#!/usr/bin/env node

/**
 * CLI Search Tool for RGFE
 * Simple command-line interface for testing semantic search functionality
 * 
 * Usage: node cli-search.js "your search query"
 * Or: npm run search "your search query"
 */

const fs = require('fs');
const path = require('path');

// Import the embedding service and search functionality
async function loadModules() {
  try {
    // Dynamic import for ES modules
    const { getEmbeddingService, DEFAULT_EMBEDDING_CONFIG } = await import('./app/lib/embedding-service.ts');
    const { create, insert, search } = await import('@orama/orama');
    
    return { getEmbeddingService, DEFAULT_EMBEDDING_CONFIG, create, insert, search };
  } catch (error) {
    console.error('❌ Failed to load modules:', error.message);
    console.log('💡 Make sure you have installed all dependencies: npm install');
    process.exit(1);
  }
}

// Node.js-compatible binary data loader
async function loadOramaDataBinaryNode(filePath) {
  try {
    console.log(`Loading Orama data from binary format: ${filePath}...`);
    
    // Read the binary file using Node.js fs
    const fileBuffer = fs.readFileSync(filePath);
    
    // Import pako for decompression
    const pako = await import('pako');
    
    // Decompress using pako
    const decompressedUint8Array = pako.ungzip(fileBuffer);
    const decompressedBuffer = Buffer.from(decompressedUint8Array);
    
    let offset = 0;
    
    // Read header length
    const headerLength = decompressedBuffer.readUInt32LE(offset);
    offset += 4;
    
    // Read header
    const headerBuffer = decompressedBuffer.slice(offset, offset + headerLength);
    const headerText = headerBuffer.toString('utf-8');
    const header = JSON.parse(headerText);
    offset += headerLength;
    
    // Read document count
    const documentCount = decompressedBuffer.readUInt32LE(offset);
    offset += 4;
    
    // Read total size (skip it, we don't need it for reading)
    offset += 4;
    
    console.log(`   Header: ${header.format}, ${header.documentCount} documents`);
    
    // Read documents
    const documents = [];
    
    for (let i = 0; i < documentCount; i++) {
      // Read id length and id
      const idLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const id = decompressedBuffer.slice(offset, offset + idLength).toString('utf-8');
      offset += idLength;
      
      // Read text length and text
      const textLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const text = decompressedBuffer.slice(offset, offset + textLength).toString('utf-8');
      offset += textLength;
      
      // Read book length and book
      const bookLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const book = decompressedBuffer.slice(offset, offset + bookLength).toString('utf-8');
      offset += bookLength;
      
      // Read bookContext length and bookContext
      const bookContextLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const bookContext = decompressedBuffer.slice(offset, offset + bookContextLength).toString('utf-8');
      offset += bookContextLength;
      
      // Read embedding length and embedding
      const embeddingLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const embeddingBuffer = decompressedBuffer.slice(offset, offset + embeddingLength);
      
      // Convert binary buffer to embedding array
      const embedding = [];
      for (let j = 0; j < embeddingLength; j += 4) {
        embedding.push(embeddingBuffer.readFloatLE(j));
      }
      offset += embeddingLength;
      
      documents.push({
        id,
        text,
        book,
        bookContext,
        embedding
      });
      
      // Debug: Print first document details
      if (i === 0) {
        console.log('\n🔍 DEBUG: First Document Details:');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`ID: "${id}"`);
        console.log(`Text: "${text}"`);
        console.log(`Book: "${book}"`);
        console.log(`BookContext: "${bookContext}"`);
        console.log(`Embedding length: ${embedding.length}`);
        console.log(`Embedding first 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
        console.log('═══════════════════════════════════════════════════════════\n');
      }
    }
    
    console.log(`✅ Binary data loaded successfully: ${documents.length} documents`);
    return documents;
  } catch (error) {
    console.error('Error loading binary Orama data:', error);
    throw error;
  }
}

async function initializeSearch() {
  console.log('🔧 Initializing search system...');
  
  const { getEmbeddingService, DEFAULT_EMBEDDING_CONFIG, create, insert, search } = await loadModules();
  
  try {
    // Initialize embedding service
    console.log('📦 Loading embedding model...');
    const embeddingService = getEmbeddingService(DEFAULT_EMBEDDING_CONFIG);
    await embeddingService.initialize((progress, message) => {
      console.log(`   ${progress}% - ${message}`);
    });
    
    // Load binary index
    console.log('📦 Loading search index...');
    const binaryPath = path.join(__dirname, 'public', 'smrithi-rgveda-embgemma-512d.bin');
    
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary index not found at: ${binaryPath}`);
    }
    
    const documents = await loadOramaDataBinaryNode(binaryPath);
    console.log(`✅ Loaded ${documents.length} documents`);
    
    // Create Orama database
    console.log('🔧 Creating search database...');
    const db = create({
      schema: {
        id: 'string',
        text: 'string',
        book: 'string',
        bookContext: 'string',
        embedding: 'vector[512]',
      },
      // Configure text indexing for Sanskrit support
      components: {
        tokenizer: {
          language: 'sanskrit', // Use Sanskrit tokenizer for Devanagari script
          stemming: false,
          stopWords: [],
        },
      },
    });
    
    // Insert documents
    console.log('📥 Inserting documents...');
    let insertedCount = 0;
    for (const doc of documents) {
      await insert(db, doc);
      insertedCount++;
      
      // Debug: Show first few documents being inserted
      if (insertedCount <= 3) {
        console.log(`   Inserted doc ${insertedCount}: ID="${doc.id}", text="${(doc.text || '').substring(0, 50)}..."`);
        console.log(`     Embedding type: ${typeof doc.embedding}, length: ${doc.embedding ? doc.embedding.length : 'null/undefined'}`);
        console.log(`     Embedding first 3 values: ${doc.embedding ? doc.embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ') : 'null/undefined'}`);
      }
    }
    console.log(`✅ Database ready - inserted ${insertedCount} documents`);
    
    // Debug: Try to retrieve a document directly to see if embedding is stored
    console.log('\n🔍 DEBUG: Testing document retrieval...');
    try {
      const retrievedDoc = await search(db, {
        term: 'rec_chv3530cmq9ueah857j0', // Search for the first document by ID
        properties: ['id'],
        limit: 1,
      });
      if (retrievedDoc.hits.length > 0) {
        const doc = retrievedDoc.hits[0].document;
        console.log(`   Retrieved doc ID: ${doc.id}`);
        console.log(`   Retrieved doc embedding type: ${typeof doc.embedding}`);
        console.log(`   Retrieved doc embedding length: ${doc.embedding ? doc.embedding.length : 'null/undefined'}`);
        if (doc.embedding && doc.embedding.length > 0) {
          console.log(`   Retrieved doc embedding first 3 values: ${doc.embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}`);
        }
      } else {
        console.log('   ❌ Could not retrieve document by ID');
      }
    } catch (error) {
      console.log(`   ❌ Error retrieving document: ${error.message}`);
    }
    
    // Debug: Try a simple search to verify database is working
    console.log('\n🔍 DEBUG: Testing database with simple search...');
    
    // Try different search configurations
    const testResults1 = await search(db, {
      term: 'अग्नि', // Search for "Agni" (fire) in Sanskrit
      properties: ['text'],
      limit: 3,
    });
    console.log(`   Test search 1 (अग्नि): found ${testResults1.hits.length} results`);
    
    const testResults2 = await search(db, {
      term: 'fire',
      properties: ['text'],
      limit: 3,
    });
    console.log(`   Test search 2 (fire): found ${testResults2.hits.length} results`);
    
    const testResults3 = await search(db, {
      term: 'Rgveda',
      properties: ['book'],
      limit: 3,
    });
    console.log(`   Test search 3 (Rgveda): found ${testResults3.hits.length} results`);
    if (testResults3.hits.length > 0) {
      console.log(`   First Rgveda result: "${(testResults3.hits[0].document.text || '').substring(0, 100)}..."`);
    }
    
    // Try a broader search without specifying properties
    const testResults4 = await search(db, {
      term: 'अग्नि',
      limit: 3,
    });
    console.log(`   Test search 4 (अग्नि, all properties): found ${testResults4.hits.length} results`);
    
    if (testResults4.hits.length > 0) {
      console.log(`   First result: "${(testResults4.hits[0].document.text || '').substring(0, 100)}..."`);
    }
    
    // Test vector search with the first document's embedding
    console.log('\n🔍 DEBUG: Testing vector search with first document embedding...');
    const firstDocEmbedding = documents[0].embedding;
    console.log(`   First doc embedding type: ${typeof firstDocEmbedding}`);
    console.log(`   First doc embedding length: ${firstDocEmbedding ? firstDocEmbedding.length : 'null/undefined'}`);
    console.log(`   First doc embedding first 5 values: ${firstDocEmbedding ? firstDocEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ') : 'null/undefined'}`);
    
    if (firstDocEmbedding && firstDocEmbedding.length > 0) {
      const vectorTestResults = await search(db, {
        mode: 'vector',
        vector: {
          value: firstDocEmbedding,
          property: 'embedding',
        },
        limit: 3,
        similarity: 0.0,
        includeVectors: true,
      });
      console.log(`   Vector test search: found ${vectorTestResults.hits.length} results`);
      if (vectorTestResults.hits.length > 0) {
        console.log(`   First vector result score: ${vectorTestResults.hits[0].score.toFixed(6)}`);
        console.log(`   First vector result: "${(vectorTestResults.hits[0].document.text || '').substring(0, 100)}..."`);
      }
    } else {
      console.log('   ❌ First document embedding is null/undefined or empty');
    }
    
    return { embeddingService, db };
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

async function performSearch(embeddingService, db, query) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🔍 SEARCHING: "${query}"`);
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    const { search } = await import('@orama/orama');
    
    // Generate embedding
    console.log('🧮 Generating query embedding...');
    const embStart = performance.now();
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    const embEnd = performance.now();
    const embDuration = (embEnd - embStart).toFixed(2);
    
    console.log(`✅ Embedding generated in ${embDuration}ms`);
    console.log(`   Dimension: ${queryEmbedding.length}`);
    console.log(`   First 5 values: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    
    // Perform search
    console.log('🔍 Performing vector search...');
    console.log(`   Query embedding dimension: ${queryEmbedding.length}`);
    console.log(`   Query embedding norm: ${Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}`);
    
    const searchStart = performance.now();
    const searchResults = await search(db, {
      mode: 'vector',
      vector: {
        value: queryEmbedding,
        property: 'embedding',
      },
      limit: 10,
      includeVectors: true, // Include vectors in results
      similarity: 0.0, // Use similarity instead of threshold
    });
    const searchEnd = performance.now();
    const searchDuration = (searchEnd - searchStart).toFixed(2);
    
    console.log(`✅ Search complete in ${searchDuration}ms`);
    console.log(`   Found ${searchResults.hits.length} results`);
    
    // Debug: Show all search results with scores
    if (searchResults.hits.length > 0) {
      console.log('\n🔍 DEBUG: All Search Results:');
      console.log('═══════════════════════════════════════════════════════════');
      searchResults.hits.forEach((hit, idx) => {
        console.log(`${idx + 1}. Score: ${hit.score.toFixed(6)}`);
        console.log(`   ID: ${hit.document.id}`);
        console.log(`   Text: "${(hit.document.text || '').substring(0, 100)}..."`);
        console.log(`   Book: ${hit.document.book}`);
        console.log(`   Context: ${hit.document.bookContext}`);
        console.log('');
      });
      console.log('═══════════════════════════════════════════════════════════\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    
    // Display results
    if (searchResults.hits.length === 0) {
      console.log('❌ No vector search results found');
      console.log('\n🔍 Trying text search as fallback...');
      
      // Try text search as fallback
      const textSearchResults = await search(db, {
        term: query,
        properties: ['text', 'book', 'bookContext'],
        limit: 5,
        tolerance: 1,
      });
      
      console.log(`   Text search found ${textSearchResults.hits.length} results`);
      
      if (textSearchResults.hits.length > 0) {
        console.log('\n📄 TEXT SEARCH RESULTS:');
        console.log('═══════════════════════════════════════════════════════════');
        textSearchResults.hits.forEach((hit, idx) => {
          console.log(`\n${idx + 1}. Score: ${hit.score.toFixed(4)}`);
          console.log(`   ID: ${hit.document.id}`);
          console.log(`   Text: "${(hit.document.text || '').substring(0, 150)}..."`);
          console.log(`   Book: ${hit.document.book}`);
          console.log(`   Context: ${hit.document.bookContext}`);
        });
        console.log('═══════════════════════════════════════════════════════════');
      } else {
        console.log('❌ No text search results found either');
      }
      return;
    }
    
    searchResults.hits.forEach((hit, idx) => {
      console.log(`\n📄 RESULT ${idx + 1}`);
      console.log('───────────────────────────────────────────────────────────');
      console.log(`Score: ${hit.score.toFixed(4)}`);
      console.log(`Source: ${hit.document.book} - ${hit.document.bookContext}`);
      console.log(`Text: ${hit.document.text}`);
      console.log('───────────────────────────────────────────────────────────');
    });
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
  }
}

async function main() {
  const query = process.argv[2];
  
  if (!query) {
    console.log('Usage: node cli-search.js "your search query"');
    console.log('Example: node cli-search.js "fire sacrifice ritual"');
    process.exit(1);
  }
  
  console.log('🚀 RGFE CLI Search Tool');
  console.log('═══════════════════════════════════════════════════════════');
  
  try {
    // Initialize system
    const { embeddingService, db } = await initializeSearch();
    
    // Perform search
    await performSearch(embeddingService, db, query);
    
    console.log('\n✅ Search completed successfully!');
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
main().catch(console.error);
