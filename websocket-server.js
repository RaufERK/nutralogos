const { WebSocketServer } = require('ws')
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
})

// Создаем WebSocket сервер на отдельном порту
const port = parseInt(process.env.WEBSOCKET_PORT || '3001')
const wss = new WebSocketServer({
  port,
  verifyClient: (info) => {
    const origin = info.origin
    const defaultOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://localhost:3000',
    ]
    const envOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const nextauthUrl = process.env.NEXTAUTH_URL
    const allowedOrigins = Array.from(
      new Set([
        ...defaultOrigins,
        ...envOrigins,
        ...(nextauthUrl ? [nextauthUrl] : []),
      ])
    )
    return !origin || allowedOrigins.includes(origin)
  },
})

const clients = new Map()

function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function sendToClient(clientId, message) {
  const client = clients.get(clientId)
  if (!client || client.readyState !== 1) {
    // WebSocket.OPEN = 1
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
    clients.delete(clientId)
    return false
  }
}

wss.on('connection', (ws) => {
  const clientId = generateClientId()
  clients.set(clientId, ws)

  console.log(`🔗 WebSocket client connected: ${clientId}`)

  // Отправляем клиенту его ID
  sendToClient(clientId, {
    type: 'start',
    messageId: 'connection',
    content: clientId,
  })

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      console.log(`📨 Message from client ${clientId}:`, message)
    } catch (error) {
      console.error('❌ Invalid WebSocket message:', error)
    }
  })

  ws.on('close', () => {
    console.log(`🔌 WebSocket client disconnected: ${clientId}`)
    clients.delete(clientId)
  })

  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for client ${clientId}:`, error)
    clients.delete(clientId)
  })
})

console.log(`🚀 WebSocket server started on port ${port}`)

// Создаем HTTP сервер для связи с Next.js
const http = require('http')
const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/send-message') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        const { clientId, message } = JSON.parse(body)
        const success = sendToClient(clientId, message)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success }))
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error.message }))
      }
    })
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

const httpPort = parseInt(process.env.WEBSOCKET_HTTP_PORT || '3002')
httpServer.listen(httpPort, () => {
  console.log(`🌐 WebSocket HTTP bridge started on port ${httpPort}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔌 Shutting down WebSocket server...')
  wss.close(() => {
    console.log('✅ WebSocket server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('🔌 Shutting down WebSocket server...')
  wss.close(() => {
    console.log('✅ WebSocket server closed')
    process.exit(0)
  })
})
