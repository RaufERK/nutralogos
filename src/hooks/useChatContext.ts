import { useState, useEffect, useCallback } from 'react'
import { ChatContextService, ChatMessage } from '@/lib/chat-context'

export interface UseChatContextReturn {
  messages: ChatMessage[]
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => Promise<void>
  clearContext: () => void
  getContextForAPI: () => Promise<ChatMessage[]>
  isContextActive: boolean
  messageCount: number
  refreshContext: () => void
}

/**
 * Hook для управления контекстом чата
 */
export const useChatContext = (): UseChatContextReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isContextActive, setIsContextActive] = useState(false)
  const [messageCount, setMessageCount] = useState(0)

  /**
   * Обновить локальное состояние из localStorage
   */
  const refreshContext = useCallback(() => {
    const session = ChatContextService.getSession()
    if (session) {
      setMessages(session.messages)
      setMessageCount(session.messages.length)
    } else {
      setMessages([])
      setMessageCount(0)
    }

    // Проверяем активность контекста
    ChatContextService.isContextActive().then(setIsContextActive)
  }, [])

  /**
   * Загружаем контекст при монтировании компонента
   */
  useEffect(() => {
    refreshContext()
  }, [refreshContext])

  /**
   * Добавить сообщение в контекст
   */
  const addMessage = useCallback(
    async (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
      try {
        await ChatContextService.addMessage(message)
        refreshContext() // Обновляем локальное состояние
      } catch (error) {
        console.error('Ошибка при добавлении сообщения в контекст:', error)
      }
    },
    [refreshContext]
  )

  /**
   * Очистить контекст
   */
  const clearContext = useCallback(() => {
    ChatContextService.clearSession()
    setMessages([])
    setMessageCount(0)
    setIsContextActive(false)
  }, [])

  /**
   * Получить контекст для отправки в API
   */
  const getContextForAPI = useCallback(async (): Promise<ChatMessage[]> => {
    try {
      return await ChatContextService.getContextForAPI()
    } catch (error) {
      console.error('Ошибка при получении контекста для API:', error)
      return []
    }
  }, [])

  return {
    messages,
    addMessage,
    clearContext,
    getContextForAPI,
    isContextActive,
    messageCount,
    refreshContext,
  }
}
