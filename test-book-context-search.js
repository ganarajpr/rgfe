#!/usr/bin/env node

/**
 * Book Context Search Test Script
 * Tests book context (verse reference) search functionality
 * 
 * Usage: node test-book-context-search.js "10.129"
 * Or: node test-book-context-search.js "10.129.1"
 */

const fs = require('fs');
const path = require('path');

// Import Orama functions
async function loadModules() {
  try {
    const orama = await import('@orama/orama');
    return { create: orama.create, insert: orama.insert, search: orama.search };
  } catch (error) {
    console.error('❌ Failed to load modules:', error.message);
    process.exit(1);
  }
}

// Node.js-compatible binary data loader
async function loadOramaDataBinaryNode(filePath) {
  try {
    console.log(`📦 Loading Orama data from binary format: ${filePath}...`);
    
    const fileBuffer = fs.readFileSync(filePath);
    const pako = await import('pako');
    const decompressedUint8Array = pako.ungzip(fileBuffer);
    const decompressedBuffer = Buffer.from(decompressedUint8Array);
    
    let offset = 0;
    
    // Read header
    const headerLength = decompressedBuffer.readUInt32LE(offset);
    offset += 4;
    const headerBuffer = decompressedBuffer.slice(offset, offset + headerLength);
    const header = JSON.parse(headerBuffer.toString('utf-8'));
    offset += headerLength;
    
    // Read document count
    const documentCount = decompressedBuffer.readUInt32LE(offset);
    offset += 4;
    offset += 4; // Skip total size
    
    console.log(`   Header: ${header.format}, ${documentCount} documents\n`);
    
    // Read documents
    const documents = [];
    
    for (let i = 0; i < documentCount; i++) {
      // Read id
      const idLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const id = decompressedBuffer.slice(offset, offset + idLength).toString('utf-8');
      offset += idLength;
      
      // Read text
      const textLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const text = decompressedBuffer.slice(offset, offset + textLength).toString('utf-8');
      offset += textLength;
      
      // Read book
      const bookLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const book = decompressedBuffer.slice(offset, offset + bookLength).toString('utf-8');
      offset += bookLength;
      
      // Read bookContext
      const bookContextLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      const bookContext = decompressedBuffer.slice(offset, offset + bookContextLength).toString('utf-8');
      offset += bookContextLength;
      
      // Read embedding
      const embeddingLength = decompressedBuffer.readUInt32LE(offset);
      offset += 4;
      offset += embeddingLength; // Skip embedding for this test
      
      documents.push({ id, text, book, bookContext });
    }
    
    console.log(`✅ Loaded ${documents.length} documents\n`);
    return documents;
  } catch (error) {
    console.error('❌ Error loading binary data:', error);
    throw error;
  }
}

// Sample some bookContext values to understand the format
function analyzeBookContexts(documents, sampleSize = 50) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 BOOK CONTEXT FORMAT ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Sample documents
  const samples = documents.slice(0, Math.min(sampleSize, documents.length));
  
  console.log(`Sample of ${samples.length} bookContext values:\n`);
  samples.forEach((doc, idx) => {
    console.log(`  ${idx + 1}. "${doc.bookContext}" (from book: ${doc.book})`);
  });
  
  // Analyze patterns
  const patterns = {
    withDots: 0,
    withoutDots: 0,
    startsWith10: 0,
    contains129: 0,
    exact10129: 0,
    startsWith10129: 0,
  };
  
  documents.forEach(doc => {
    const ctx = doc.bookContext || '';
    if (ctx.includes('.')) patterns.withDots++;
    if (!ctx.includes('.')) patterns.withoutDots++;
    if (ctx.startsWith('10.')) patterns.startsWith10++;
    if (ctx.includes('129')) patterns.contains129++;
    if (ctx === '10.129') patterns.exact10129++;
    if (ctx.startsWith('10.129')) patterns.startsWith10129++;
  });
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📈 PATTERN ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Total documents: ${documents.length}`);
  console.log(`  - With dots: ${patterns.withDots}`);
  console.log(`  - Without dots: ${patterns.withoutDots}`);
  console.log(`  - Starting with "10.": ${patterns.startsWith10}`);
  console.log(`  - Containing "129": ${patterns.contains129}`);
  console.log(`  - Exactly "10.129": ${patterns.exact10129}`);
  console.log(`  - Starting with "10.129": ${patterns.startsWith10129}\n`);
  
  // Find actual examples matching "10.129"
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DOCUMENTS MATCHING "10.129" PATTERNS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const matches = documents.filter(doc => {
    const ctx = doc.bookContext || '';
    return ctx.startsWith('10.129') || ctx === '10.129' || ctx.includes('10.129');
  }).slice(0, 10);
  
  if (matches.length > 0) {
    console.log(`Found ${matches.length} documents (showing first 10):\n`);
    matches.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. bookContext: "${doc.bookContext}"`);
      console.log(`     book: ${doc.book}`);
      console.log(`     text preview: ${doc.text.substring(0, 60)}...\n`);
    });
  } else {
    console.log('⚠️  No documents found matching "10.129" patterns\n');
  }
}

// Test different search strategies
async function testSearchStrategies(db, searchFn, searchTerm) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🔍 TESTING SEARCH STRATEGIES FOR: "${searchTerm}"`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Parse the search term
  const parts = searchTerm.split('.');
  let searchPrefix = searchTerm;
  
  if (parts.length >= 2) {
    searchPrefix = `${parts[0]}.${parts[1]}.`;
  } else if (parts.length === 1) {
    searchPrefix = `${parts[0]}.`;
  }
  
  const numericPrefix = searchPrefix.replace(/\.$/, '');
  
  console.log(`Search prefix: "${searchPrefix}"`);
  console.log(`Numeric prefix: "${numericPrefix}"\n`);
  
  const strategies = [
    {
      name: 'Strategy 1: Exact term with tolerance 0',
      config: {
        term: searchPrefix,
        properties: ['bookContext'],
        limit: 50,
        tolerance: 0,
      }
    },
    {
      name: 'Strategy 2: Exact term with tolerance 1',
      config: {
        term: searchPrefix,
        properties: ['bookContext'],
        limit: 50,
        tolerance: 1,
      }
    },
    {
      name: 'Strategy 3: Numeric prefix with tolerance 1',
      config: {
        term: numericPrefix,
        properties: ['bookContext'],
        limit: 50,
        tolerance: 1,
      }
    },
    {
      name: 'Strategy 4: First part only (e.g., "10")',
      config: {
        term: parts[0],
        properties: ['bookContext'],
        limit: 50,
        tolerance: 1,
      }
    },
    {
      name: 'Strategy 5: No tolerance, higher limit',
      config: {
        term: numericPrefix,
        properties: ['bookContext'],
        limit: 500,
        tolerance: 0,
      }
    },
  ];
  
  for (const strategy of strategies) {
    console.log(`\n${strategy.name}`);
    console.log('───────────────────────────────────────────────────────────');
    
    try {
      const results = await searchFn(db, strategy.config);
      console.log(`   Found ${results.hits.length} results`);
      
      // Filter for prefix matches
      const prefixMatches = results.hits.filter(hit => {
        const ctx = hit.document.bookContext || '';
        return ctx && ctx.startsWith(searchPrefix);
      });
      
      console.log(`   After prefix filter (startsWith "${searchPrefix}"): ${prefixMatches.length} matches`);
      
      if (prefixMatches.length > 0) {
        console.log('\n   First 5 matches:');
        prefixMatches.slice(0, 5).forEach((hit, idx) => {
          console.log(`     ${idx + 1}. "${hit.document.bookContext}" (score: ${hit.score.toFixed(4)})`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

// Main test function
async function main() {
  const searchQuery = process.argv[2] || '10.129';
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 BOOK CONTEXT SEARCH TEST SCRIPT');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Testing search for: "${searchQuery}"\n`);
  
  const { create, insert, search } = await loadModules();
  
  try {
    // Load binary index
    const binaryPath = path.join(__dirname, 'public', 'smrthi-rgveda-test-512d.bin');
    
    // Try alternative paths
    const alternativePaths = [
      path.join(__dirname, 'public', 'smrithi-rgveda-embgemma-512d.bin'),
      path.join(__dirname, 'public', 'smrthi-rgveda-test-512d.bin'),
    ];
    
    let actualPath = binaryPath;
    if (!fs.existsSync(binaryPath)) {
      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          actualPath = altPath;
          break;
        }
      }
      if (!fs.existsSync(actualPath)) {
        throw new Error(`Binary index not found. Tried:\n  - ${binaryPath}\n  - ${alternativePaths.join('\n  - ')}`);
      }
    }
    
    console.log(`📂 Using index: ${actualPath}\n`);
    const documents = await loadOramaDataBinaryNode(actualPath);
    
    // Analyze bookContext format
    analyzeBookContexts(documents);
    
    // Create Orama database
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔧 Creating search database...');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const db = create({
      schema: {
        id: 'string',
        text: 'string',
        book: 'string',
        bookContext: 'string',
        embedding: 'vector[512]',
      },
    });
    
    // Insert documents
    console.log('📥 Inserting documents...');
    let insertedCount = 0;
    for (const doc of documents) {
      await insert(db, {
        id: doc.id,
        text: doc.text,
        book: doc.book,
        bookContext: doc.bookContext,
        embedding: new Array(512).fill(0), // Dummy embedding for this test
      });
      insertedCount++;
      if (insertedCount % 1000 === 0) {
        process.stdout.write(`\r   Inserted ${insertedCount}/${documents.length} documents...`);
      }
    }
    console.log(`\n✅ Inserted ${insertedCount} documents\n`);
    
    // Test search strategies
    await testSearchStrategies(db, search, searchQuery);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ TEST COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();

