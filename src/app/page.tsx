'use client'

import { useState, useEffect, useRef } from 'react'
import { AskResponse, Document } from '@/lib/types'
import { useChatContext } from '@/hooks/useChatContext'

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
  }, [messages.length, isLoading])

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
      answer: '', // Пустой ответ пока идет загрузка
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

      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: currentQuestion,
          context: context.length > 0 ? context : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: AskResponse = await response.json()

      const finalMessage: Message = {
        id: tempMessageId, // Тот же ID чтобы заменить временное сообщение
        question: currentQuestion,
        answer: data.answer,
        sources: data.sources || [],
        hasContext: data.hasContext,
        sourcesCount: data.sourcesCount,
        timestamp: new Date(),
      }

      // Заменяем временное сообщение на полное
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempMessageId ? finalMessage : msg))
      )

      // Добавляем ответ ассистента в контекст
      await addContextMessage({
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      })

      // Автоматически сворачиваем источники для нового сообщения
      if (data.hasContext && data.sources && data.sources.length > 0) {
        setCollapsedSources((prev) => new Set([...prev, tempMessageId]))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
      // Удаляем временное сообщение при ошибке
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId))
    } finally {
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

                {/* Answer - показываем только если есть ответ */}
                {message.answer && (
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
                          message.hasContext ? 'bg-purple-600' : 'bg-indigo-600'
                        }`}
                      >
                        <span className='text-white text-sm font-medium'>
                          AI
                        </span>
                      </div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-3 mb-2'>
                          <h3 className='text-white font-medium'>Ответ:</h3>
                        </div>
                        <div className='text-gray-300 leading-relaxed whitespace-pre-wrap'>
                          {message.answer}
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

            {/* Loading with AI icon */}
            {isLoading && (
              <div className='bg-gray-800/90 rounded-lg p-6 border border-gray-700'>
                <div className='flex items-start gap-3'>
                  <div className='w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center flex-shrink-0'>
                    <span className='text-white text-sm font-medium'>AI</span>
                  </div>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 text-gray-300'>
                      <div className='w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
                      Ищу информацию и генерирую ответ...
                    </div>
                  </div>
                </div>
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
