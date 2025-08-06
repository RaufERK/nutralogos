import { ChatOpenAI } from '@langchain/openai'
import { RAGSettings } from '@/lib/settings-service'

/**
 * OpenAI Chat Model configuration for RAG system
 * Using dynamic settings from database
 */
export async function createLLM(): Promise<ChatOpenAI> {
  // Всегда загружаем актуальные настройки из базы данных
  const modelName = await RAGSettings.getAIModel()
  const temperature = await RAGSettings.getTemperature()
  const maxTokens = await RAGSettings.getMaxTokens()

  return new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY!,
    modelName, // Из настроек openai_chat_model
    temperature, // Из настроек temperature
    maxTokens, // Из настроек max_tokens
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
  })
}

/**
 * Default LLM instance for backward compatibility
 * Note: This uses default values, use createLLM() for dynamic settings
 * WARNING: This instance uses hardcoded values - prefer createLLM() for dynamic settings
 */
export const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY!,
  modelName: 'gpt-4o', // HARDCODED - use createLLM() instead
  temperature: 0.4, // HARDCODED - use createLLM() instead
  maxTokens: 4000, // HARDCODED - use createLLM() instead
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
})

/**
 * Create LLM instance with custom parameters
 * @param options - Custom LLM options
 * @returns ChatOpenAI instance
 */
export async function createCustomLLM(
  options: {
    modelName?: string
    temperature?: number
    maxTokens?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
  } = {}
) {
  // Загружаем настройки по умолчанию из базы данных
  const defaultModelName = await RAGSettings.getAIModel()
  const defaultTemperature = await RAGSettings.getTemperature()
  const defaultMaxTokens = await RAGSettings.getMaxTokens()

  return new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY!,
    modelName: options.modelName || defaultModelName, // Из настроек или переопределение
    temperature: options.temperature ?? defaultTemperature, // Из настроек или переопределение
    maxTokens: options.maxTokens ?? defaultMaxTokens, // Из настроек или переопределение
    topP: options.topP ?? 1.0,
    frequencyPenalty: options.frequencyPenalty ?? 0.0,
    presencePenalty: options.presencePenalty ?? 0.0,
  })
}

/**
 * Test LLM connection and basic functionality
 * @returns Promise<boolean> - True if LLM is working
 */
export async function testLLMConnection(): Promise<boolean> {
  try {
    const response = await llm.invoke([
      {
        role: 'user',
        content: "Отвечь просто: 'Соединение установлено'",
      },
    ])

    console.log('✅ LLM Connection Test:', response.content)
    return true
  } catch (error) {
    console.error('❌ LLM Connection Test Failed:', error)
    return false
  }
}
