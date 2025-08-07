import { getWebSocketServer } from './websocket-server'

/**
 * Инициализация WebSocket сервера при старте приложения
 * Вызывается автоматически при первом обращении к API
 */
export function initializeWebSocketServer() {
  if (typeof window === 'undefined') {
    // Только на сервере
    try {
      console.log('🚀 Initializing WebSocket server...')
      const wsServer = getWebSocketServer()
      console.log('✅ WebSocket server initialized successfully')
      return wsServer
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket server:', error)
      return null
    }
  }
  return null
}

// Автоматическая инициализация при импорте (только на сервере)
if (typeof window === 'undefined' && process.env.ENABLE_STREAMING === 'true') {
  initializeWebSocketServer()
}
