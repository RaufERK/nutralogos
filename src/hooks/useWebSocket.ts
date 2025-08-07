import { useState, useEffect, useRef, useCallback } from 'react'
import { Document } from '@/lib/types'

export interface WSMessage {
  type: 'start' | 'chunk' | 'sources' | 'complete' | 'error'
  messageId: string
  content?: string
  sources?: Document[]
  error?: string
  question?: string
}

export interface StreamingMessage {
  messageId: string
  question: string
  content: string
  sources: Document[]
  isComplete: boolean
  hasError: boolean
  error?: string
}

export interface UseWebSocketReturn {
  isConnected: boolean
  clientId: string | null
  sendStreamingRequest: (
    question: string,
    context?: unknown[]
  ) => Promise<string>
  streamingMessages: Map<string, StreamingMessage>
  clearStreamingMessage: (messageId: string) => void
  connectionError: string | null
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [streamingMessages, setStreamingMessages] = useState<
    Map<string, StreamingMessage>
  >(new Map())
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const wsUrl = `ws://localhost:${
        process.env.NEXT_PUBLIC_WEBSOCKET_PORT || '3001'
      }`
      console.log('🔗 Connecting to WebSocket:', wsUrl)

      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected')
        setIsConnected(true)
        setConnectionError(null)
        reconnectAttempts.current = 0
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error)
        }
      }

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)

        // Автоматическое переподключение
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          )
          console.log(
            `🔄 Reconnecting in ${delay}ms (attempt ${
              reconnectAttempts.current + 1
            }/${maxReconnectAttempts})`
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        } else {
          setConnectionError(
            'Не удалось подключиться к серверу после нескольких попыток'
          )
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setConnectionError('Ошибка подключения к серверу')
      }
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error)
      setConnectionError('Не удалось создать подключение')
    }
  }, [])

  const handleWebSocketMessage = useCallback((message: WSMessage) => {
    console.log('📨 Received WebSocket message:', message)

    switch (message.type) {
      case 'start':
        if (message.messageId === 'connection' && message.content) {
          // Это сообщение с clientId при подключении
          setClientId(message.content)
          console.log('🆔 Client ID received:', message.content)
        } else {
          // Начало streaming сообщения
          setStreamingMessages((prev) => {
            const newMap = new Map(prev)
            newMap.set(message.messageId, {
              messageId: message.messageId,
              question: message.question || '',
              content: '',
              sources: [],
              isComplete: false,
              hasError: false,
            })
            return newMap
          })
        }
        break

      case 'chunk':
        if (message.content) {
          setStreamingMessages((prev) => {
            const newMap = new Map(prev)
            const existing = newMap.get(message.messageId)
            if (existing) {
              newMap.set(message.messageId, {
                ...existing,
                content: existing.content + message.content,
              })
            }
            return newMap
          })
        }
        break

      case 'sources':
        if (message.sources) {
          setStreamingMessages((prev) => {
            const newMap = new Map(prev)
            const existing = newMap.get(message.messageId)
            if (existing) {
              newMap.set(message.messageId, {
                ...existing,
                sources: message.sources || [],
              })
            }
            return newMap
          })
        }
        break

      case 'complete':
        setStreamingMessages((prev) => {
          const newMap = new Map(prev)
          const existing = newMap.get(message.messageId)
          if (existing) {
            newMap.set(message.messageId, {
              ...existing,
              isComplete: true,
            })
          }
          return newMap
        })
        break

      case 'error':
        setStreamingMessages((prev) => {
          const newMap = new Map(prev)
          const existing = newMap.get(message.messageId)
          if (existing) {
            newMap.set(message.messageId, {
              ...existing,
              hasError: true,
              error: message.error,
              isComplete: true,
            })
          }
          return newMap
        })
        break
    }
  }, [])

  const sendStreamingRequest = useCallback(
    async (question: string, context?: unknown[]): Promise<string> => {
      if (!isConnected || !clientId) {
        throw new Error('WebSocket не подключен')
      }

      const messageId = `msg_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`

      try {
        // Отправляем HTTP запрос на streaming endpoint (используем демо-режим)
        const response = await fetch('/api/ask-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            context,
            clientId,
            messageId,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Ошибка сервера')
        }

        console.log('🚀 Streaming request sent for message:', messageId)
        return messageId
      } catch (error) {
        console.error('❌ Failed to send streaming request:', error)
        throw error
      }
    },
    [isConnected, clientId]
  )

  const clearStreamingMessage = useCallback((messageId: string) => {
    setStreamingMessages((prev) => {
      const newMap = new Map(prev)
      newMap.delete(messageId)
      return newMap
    })
  }, [])

  // Подключение при монтировании компонента
  useEffect(() => {
    connect()

    // Cleanup при размонтировании
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  // Обновляем handleWebSocketMessage при изменении
  useEffect(() => {
    // Зависимость обновлена
  }, [handleWebSocketMessage])

  return {
    isConnected,
    clientId,
    sendStreamingRequest,
    streamingMessages,
    clearStreamingMessage,
    connectionError,
  }
}
