import { WebSocket, WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'
import { Document } from '@/lib/types'

export interface WSMessage {
  type: 'start' | 'chunk' | 'sources' | 'complete' | 'error'
  messageId: string
  content?: string
  sources?: Document[]
  error?: string
  question?: string
}

export class StreamingWebSocketServer {
  private wss: WebSocketServer | null = null
  private clients = new Map<string, WebSocket>()

  constructor() {
    // Сервер будет создан при первом запуске
  }

  /**
   * Инициализация WebSocket сервера
   */
  public init() {
    if (this.wss) return

    const port = parseInt(process.env.WEBSOCKET_PORT || '3001')

    this.wss = new WebSocketServer({
      port,
      verifyClient: (info) => {
        // Базовая проверка origin для безопасности
        const origin = info.origin
        const allowedOrigins = [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'https://localhost:3000',
        ]
        return !origin || allowedOrigins.includes(origin)
      },
    })

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId()
      this.clients.set(clientId, ws)

      console.log(`🔗 WebSocket client connected: ${clientId}`)

      // Отправляем клиенту его ID
      this.sendToClient(clientId, {
        type: 'start',
        messageId: 'connection',
        content: clientId,
      })

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          this.handleClientMessage(clientId, message)
        } catch (error) {
          console.error('❌ Invalid WebSocket message:', error)
        }
      })

      ws.on('close', () => {
        console.log(`🔌 WebSocket client disconnected: ${clientId}`)
        this.clients.delete(clientId)
      })

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for client ${clientId}:`, error)
        this.clients.delete(clientId)
      })
    })

    console.log(`🚀 WebSocket server started on port ${port}`)
  }

  /**
   * Отправка сообщения конкретному клиенту
   */
  public sendToClient(clientId: string, message: WSMessage): boolean {
    const client = this.clients.get(clientId)
    if (!client || client.readyState !== WebSocket.OPEN) {
      console.warn(
        `⚠️ Client ${clientId} not available for message:`,
        message.type
      )
      return false
    }

    try {
      client.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error(`❌ Failed to send message to client ${clientId}:`, error)
      this.clients.delete(clientId)
      return false
    }
  }

  /**
   * Broadcast сообщения всем подключенным клиентам
   */
  public broadcast(message: WSMessage): void {
    const deadClients: string[] = []

    for (const [clientId, client] of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message))
        } catch (error) {
          console.error(`❌ Broadcast failed for client ${clientId}:`, error)
          deadClients.push(clientId)
        }
      } else {
        deadClients.push(clientId)
      }
    }

    // Удаляем неактивных клиентов
    deadClients.forEach((clientId) => this.clients.delete(clientId))
  }

  /**
   * Обработка сообщений от клиентов
   */
  private handleClientMessage(
    clientId: string,
    message: Record<string, unknown>
  ): void {
    console.log(`📨 Message from client ${clientId}:`, message)

    // Здесь можно добавить обработку входящих сообщений от клиентов
    // Например, подтверждения получения или запросы на переподключение
  }

  /**
   * Генерация уникального ID клиента
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Получение количества подключенных клиентов
   */
  public getClientCount(): number {
    return this.clients.size
  }

  /**
   * Получение списка активных клиентов
   */
  public getActiveClients(): string[] {
    const activeClients: string[] = []

    for (const [clientId, client] of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        activeClients.push(clientId)
      }
    }

    return activeClients
  }

  /**
   * Закрытие сервера
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve()
        return
      }

      // Закрываем все подключения
      for (const [, client] of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.close()
        }
      }

      this.clients.clear()

      // Закрываем сервер
      this.wss.close(() => {
        console.log('🔌 WebSocket server closed')
        this.wss = null
        resolve()
      })
    })
  }
}

// Singleton instance
let wsServerInstance: StreamingWebSocketServer | null = null

/**
 * Получение singleton экземпляра WebSocket сервера
 */
export function getWebSocketServer(): StreamingWebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new StreamingWebSocketServer()
    wsServerInstance.init()
  }
  return wsServerInstance
}

/**
 * Типы для использования в других модулях
 */
export type { WSMessage }
