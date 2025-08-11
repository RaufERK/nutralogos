'use client'

import { useState, useEffect, useRef } from 'react'
import { Document } from '@/lib/types'
import { useChatContext } from '@/hooks/useChatContext'
import { useWebSocket } from '@/hooks/useWebSocket'

interface Message {
  id: string
  question: string
  answer: string
  sources: Document[]
  hasContext: boolean
  sourcesCount: number
  timestamp: Date
}

export default function Home() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(
    new Set() // По умолчанию все источники свёрнуты
  )
  const [isStreamingMode] = useState(true) // Всегда включен стриминг
  const [welcomeMessage, setWelcomeMessage] =
    useState(`Этот чат-помощник создан, чтобы помогать вам находить ответы на вопросы о здоровье, питании и нутрициологической поддержке.

Задайте вопрос — и я подберу для вас наиболее точную и полезную информацию из нашей экспертной базы знаний.`)

  // Hook для управления контекстом чата
  const {
    addMessage: addContextMessage,
    clearContext,
    getContextForAPI,
    isContextActive,
    messageCount,
  } = useChatContext()

  // WebSocket hook для стриминга
  const {
    isConnected: wsConnected,
    sendStreamingRequest,
    streamingMessages,
    clearStreamingMessage,
    connectionError,
  } = useWebSocket()

  // Ref для автоматического скролла к последнему сообщению
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Загружаем приветственное сообщение из настроек при инициализации
  useEffect(() => {
    const loadWelcomeMessage = async () => {
      try {
        const response = await fetch('/api/settings/welcome-message')
        if (response.ok) {
          const data = await response.json()
          setWelcomeMessage(data.welcomeMessage)
        }
      } catch (error) {
        console.error('Ошибка при загрузке приветственного сообщения:', error)
        // Используем значение по умолчанию
      }
    }
    loadWelcomeMessage()
  }, [])

  // Простой и надежный автоскролл - к концу placeholder при любых изменениях
  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end', // Всегда к концу - включая placeholder
          inline: 'nearest',
        })
      }, 200)
    }
  }, [messages.length, isLoading, streamingMessages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!question.trim()) return

    const currentQuestion = question.trim()
    setQuestion('') // Очищаем инпут сразу после отправки
    setIsLoading(true)
    setError('')

    // 🔥 Сразу показываем вопрос пользователя (временное сообщение)
    const tempMessageId = Date.now().toString()
    const tempMessage: Message = {
      id: tempMessageId,
      question: currentQuestion,
      answer: 'Печатаю ответ...', // Временный текст для поиска
      sources: [],
      hasContext: false,
      sourcesCount: 0,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, tempMessage])

    // Добавляем вопрос пользователя в контекст
    await addContextMessage({
      role: 'user',
      content: currentQuestion,
    })

    try {
      // Получаем контекст для отправки в API
      const context = await getContextForAPI()

      // 🚀 STREAMING РЕЖИМ (всегда включен)
      console.log('🔥 Используем streaming режим')

      const streamingMessageId = await sendStreamingRequest(
        currentQuestion,
        context.length > 0 ? context : undefined
      )

      // Мониторинг теперь через useEffect - см. ниже
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
      // Удаляем временное сообщение при ошибке
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId))
      setIsLoading(false)
    }
  }

  const toggleSourceCollapse = (messageId: string) => {
    setCollapsedSources((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId) // Разворачиваем
      } else {
        newSet.add(messageId) // Сворачиваем
      }
      return newSet
    })
  }

  // Получаем текущее streaming сообщение для отображения
  const getCurrentStreamingContent = (messageId: string): string => {
    if (!isLoading) return ''

    // Ищем временное сообщение с "Печатаю ответ..."
    const tempMessage = messages.find(
      (m) => m.id === messageId && m.answer === 'Печатаю ответ...'
    )
    if (!tempMessage) return ''

    // Ищем соответствующее streaming сообщение по вопросу
    for (const [, streamingMsg] of streamingMessages) {
      if (streamingMsg.question === tempMessage.question) {
        const content = streamingMsg.content || ''
        // Добавляем дебаг только для первых 50 символов
        if (content.length > 0 && content.length % 50 === 0) {
          console.log('📝 Streaming content length:', content.length, 'chars')
        }
        return content
      }
    }

    return ''
  }

  // Мониторинг завершения стриминга через useEffect
  useEffect(() => {
    if (!isLoading) return

    // Проверяем все streaming сообщения на завершение
    for (const [messageId, streamingMsg] of streamingMessages) {
      if (streamingMsg?.isComplete) {
        // Находим соответствующее временное сообщение
        const tempMessage = messages.find(
          (m) =>
            m.answer === 'Печатаю ответ...' &&
            m.question === streamingMsg.question
        )

        if (tempMessage) {
          const sources = streamingMsg.sources || []
          const finalMessage: Message = {
            id: tempMessage.id,
            question: streamingMsg.question,
            answer: streamingMsg.content,
            sources: sources,
            hasContext: sources.length > 0,
            sourcesCount: sources.length,
            timestamp: new Date(),
          }

          // Заменяем временное сообщение на полное
          setMessages((prev) =>
            prev.map((msg) => (msg.id === tempMessage.id ? finalMessage : msg))
          )

          // Добавляем ответ ассистента в контекст
          addContextMessage({
            role: 'assistant',
            content: streamingMsg.content,
            sources: sources,
          })

          // Автоматически сворачиваем источники
          if (sources.length > 0) {
            setCollapsedSources((prev) => new Set([...prev, tempMessage.id]))
          }

          // Очищаем streaming сообщение
          clearStreamingMessage(messageId)
          setIsLoading(false)
          break
        } else {
          // Принудительно останавливаем загрузку, даже если не нашли сообщение
          setIsLoading(false)
          clearStreamingMessage(messageId)
        }
      }
    }
  }, [
    streamingMessages,
    isLoading,
    messages,
    addContextMessage,
    clearStreamingMessage,
  ])

  return (
    <div className='min-h-screen bg-gray-900/40 flex flex-col relative z-10'>
      {/* Main Content - Четкое разделение пространств */}
      <main
        className='flex-1 flex flex-col'
        style={{
          paddingBottom:
            messages.length > 0 || isLoading || error ? '100px' : '0px',
        }}
      >
        {/* Messages Area - Чистый поток без хаков */}
        <div className='flex-1 overflow-y-auto px-4 py-8 ultra-smooth-scroll'>
          <div className='max-w-4xl mx-auto space-y-6'>
            {/* Welcome Message with Centered Input */}
            {messages.length === 0 && !isLoading && !error && (
              <div className='flex flex-col items-center justify-center min-h-[80vh]'>
                <div className='text-center mb-12'>
                  <p className='text-gray-300 text-base max-w-3xl mx-auto leading-relaxed whitespace-pre-line'>
                    {welcomeMessage}
                  </p>
                </div>

                {/* Centered Input */}
                <div className='w-full max-w-2xl'>
                  {/* Connection Error */}
                  {connectionError && (
                    <div className='mb-4 text-center'>
                      <div className='text-xs text-red-400 bg-red-900/30 px-3 py-2 rounded border border-red-700/50 inline-block'>
                        ⚠️ {connectionError}
                      </div>
                    </div>
                  )}

                  {/* Context Status */}
                  {isContextActive && messageCount > 0 && (
                    <div className='mb-4 flex items-center justify-center gap-4'>
                      <div className='flex items-center gap-2 text-sm text-blue-400 bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-700/50'>
                        <svg
                          className='w-4 h-4'
                          fill='none'
                          stroke='currentColor'
                          viewBox='0 0 24 24'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                          />
                        </svg>
                        <span>
                          Контекст активен: {Math.floor(messageCount / 2)}{' '}
                          диалогов
                        </span>
                      </div>
                      <button
                        onClick={clearContext}
                        className='text-sm text-red-400 hover:text-red-300 bg-red-900/30 px-3 py-2 rounded-lg border border-red-700/50 hover:bg-red-900/50 transition-colors'
                      >
                        Очистить контекст
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className='relative'>
                    <div className='relative'>
                      <input
                        type='text'
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder='Задайте ваш вопрос...'
                        className='w-full px-4 py-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white placeholder-gray-400'
                        disabled={isLoading}
                      />
                      <button
                        type='submit'
                        disabled={isLoading || !question.trim()}
                        className='absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors'
                      >
                        {isLoading ? (
                          <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                        ) : (
                          <svg
                            className='w-4 h-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Messages History */}
            {messages.map((message) => (
              <div key={message.id} className='space-y-4'>
                {/* Question */}
                <div className='flex justify-end'>
                  <div className='max-w-[80%] bg-gray-700 text-white rounded-lg px-4 py-3'>
                    <p className='text-sm'>{message.question}</p>
                  </div>
                </div>

                {/* Answer - показываем только если есть ответ или это streaming */}
                {(message.answer || isLoading) && (
                  <div
                    className={`rounded-lg p-6 border ${
                      message.hasContext
                        ? 'bg-purple-900/70 border-purple-700'
                        : 'bg-indigo-900/70 border-indigo-700'
                    }`}
                  >
                    <div className='flex items-start gap-3 mb-4'>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          message.hasContext ? 'bg-purple-600' : 'bg-yellow-600'
                        }`}
                      >
                        <span className='text-white text-sm font-medium'>
                          AI
                        </span>
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-3 mb-2'>
                          <h3 className='text-white font-medium'>Ответ:</h3>
                          {isLoading && !message.answer && (
                            <div className='flex items-center gap-2 text-xs text-blue-400'>
                              <div className='w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin'></div>
                              <span>Печатаю ответ...</span>
                            </div>
                          )}
                        </div>
                        <div className='text-gray-300 leading-relaxed whitespace-pre-wrap'>
                          {/* Показываем streaming контент для временных сообщений, иначе готовый ответ */}
                          {message.answer === 'Печатаю ответ...' && isLoading
                            ? getCurrentStreamingContent(message.id) ||
                              'Генерирую ответ...'
                            : message.answer}
                          {/* Streaming cursor effect */}
                          {message.answer === 'Печатаю ответ...' &&
                            isLoading && (
                              <span className='inline-block w-2 h-5 bg-blue-400 ml-1 animate-pulse'></span>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Sources */}
                    {message.hasContext && message.sources.length > 0 && (
                      <div className='mt-6 pt-6 border-t border-gray-700'>
                        <button
                          onClick={() => toggleSourceCollapse(message.id)}
                          className='flex items-center gap-2 text-white font-medium mb-3 hover:text-blue-300 transition-colors'
                        >
                          <span>Источники ({message.sources.length}):</span>
                          <svg
                            className={`w-4 h-4 transition-transform ${
                              !collapsedSources.has(message.id)
                                ? 'rotate-180'
                                : ''
                            }`}
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M19 9l-7 7-7-7'
                            />
                          </svg>
                        </button>

                        {!collapsedSources.has(message.id) && (
                          <div className='space-y-3'>
                            {message.sources.map((source, index) => (
                              <div
                                key={source.id}
                                className='bg-gray-700/90 rounded-lg p-4 border border-gray-600'
                              >
                                <div className='flex items-start gap-3'>
                                  <span className='flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium'>
                                    {index + 1}
                                  </span>
                                  <div className='flex-1'>
                                    <p className='text-gray-300 text-sm leading-relaxed'>
                                      {source.content}
                                    </p>
                                    {source.metadata && (
                                      <div className='mt-3 flex gap-2'>
                                        {source.metadata.category && (
                                          <span className='px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded border border-blue-600/30'>
                                            {source.metadata.category}
                                          </span>
                                        )}
                                        {source.metadata.topic && (
                                          <span className='px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded border border-green-600/30'>
                                            {source.metadata.topic}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Error Message */}
            {error && (
              <div className='bg-red-900/60 border border-red-700 rounded-lg p-4'>
                <p className='text-red-400'>❌ {error}</p>
              </div>
            )}

            {/* 📌 Placeholder для предотвращения скрытия под панелью ввода */}
            {(isLoading ||
              (messages.length > 0 && messages[messages.length - 1])) && (
              <div className='h-24'></div>
            )}

            {/* 🎯 Элемент для автоскролла - ПОСЛЕ всего контента включая placeholder */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* 📌 Фиксированная панель ввода - всегда внизу экрана */}
      {(messages.length > 0 || isLoading || error) && (
        <div className='fixed bottom-0 left-0 right-0 border-t border-gray-700 bg-indigo-900/95 backdrop-blur-sm p-4 z-20'>
          <div className='max-w-4xl mx-auto'>
            {/* Context Status in Fixed Panel */}
            {isContextActive && messageCount > 0 && (
              <div className='mb-3 flex items-center justify-between'>
                <div className='flex items-center gap-2 text-xs text-blue-400'>
                  <svg
                    className='w-3 h-3'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                    />
                  </svg>
                  <span>Контекст: {Math.floor(messageCount / 2)} диалогов</span>
                </div>
                <button
                  onClick={clearContext}
                  className='text-xs text-red-400 hover:text-red-300 transition-colors'
                >
                  Очистить
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className='relative'>
              <div className='relative'>
                <input
                  type='text'
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder='Задайте ваш вопрос...'
                  className='w-full px-4 py-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white placeholder-gray-400'
                  disabled={isLoading}
                />
                <button
                  type='submit'
                  disabled={isLoading || !question.trim()}
                  className='absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors'
                >
                  {isLoading ? (
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                  ) : (
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8'
                      />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
