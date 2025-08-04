/**
 * Test script for LangChain integration
 * Run: npx tsx scripts/test-langchain.ts
 */

import dotenv from 'dotenv'
import { testLLMConnection } from '../src/lib/langchain/llm'
import { getEmbeddingVector } from '../src/lib/langchain/embeddings'
import { createEnhancedRAGChain } from '../src/lib/langchain/rag-chain'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function testLangChainIntegration() {
  console.log('🧪 Testing LangChain Integration...\n')

  // Test 1: LLM Connection
  console.log('1️⃣ Testing LLM Connection...')
  try {
    const llmWorking = await testLLMConnection()
    console.log(
      `   ${llmWorking ? '✅' : '❌'} LLM Connection: ${
        llmWorking ? 'OK' : 'FAILED'
      }\n`
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('   ❌ LLM Connection Error:', errorMessage)
  }

  // Test 2: Embeddings
  console.log('2️⃣ Testing Embeddings...')
  try {
    const testText = 'Что такое духовность?'
    const embedding = await getEmbeddingVector(testText)
    console.log(`   ✅ Embedding Vector: ${embedding.length} dimensions`)
    console.log(
      `   📊 Sample values: [${embedding
        .slice(0, 3)
        .map((n) => n.toFixed(4))
        .join(', ')}...]\n`
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('   ❌ Embeddings Error:', errorMessage)
  }

  // Test 3: Enhanced RAG Chain
  console.log('3️⃣ Testing Enhanced RAG Chain...')
  try {
    const ragChain = createEnhancedRAGChain()
    const testQuery = 'Что такое медитация?'

    console.log(`   🔍 Query: "${testQuery}"`)
    const result = await ragChain.call({ query: testQuery })

    console.log(`   ✅ Response received: ${result.text.length} characters`)
    console.log(`   📚 Sources found: ${result.sourceDocuments.length}`)
    console.log(
      `   🎯 Relevance scores: [${result.relevanceScores
        .map((s) => s.toFixed(2))
        .join(', ')}]`
    )

    if (result.text.length > 0) {
      console.log(
        `   📝 Sample response: "${result.text.substring(0, 100)}..."`
      )
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('   ❌ RAG Chain Error:', errorMessage)
    if (errorMessage.includes('QDRANT')) {
      console.log('   💡 Hint: Make sure Qdrant is configured and has data')
    }
  }

  console.log('\n🎉 LangChain Integration Test Complete!')
}

// Run the test
testLangChainIntegration().catch(console.error)
