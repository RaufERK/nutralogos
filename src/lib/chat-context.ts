// Типы для контекста чата
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  sources?: Array<{
    id: string
    content: string
    metadata?: Record<string, unknown>
  }>
}

export interface ChatSession {
  sessionId: string
  messages: ChatMessage[]
  createdAt: number
  lastActivity: number
}

// Настройки контекста (кэшируются для производительности)
interface ContextSettings {
  enabled: boolean
  messagesLimit: number
  sessionDurationHours: number
  includeSources: boolean
}

/**
 * Сервис для управления контекстом чата через localStorage
 */
export class ChatContextService {
  private static readonly STORAGE_KEY = 'rag-chat-session'
  private static settingsCache: ContextSettings | null = null
  private static settingsCacheExpiry = 0
  private static readonly SETTINGS_CACHE_TTL = 5 * 60 * 1000 // 5 минут

  /**
   * Получить текущую сессию из localStorage
   */
  static getSession(): ChatSession | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return null

      const session: ChatSession = JSON.parse(stored)

      // Проверяем валидность структуры
      if (!session.sessionId || !Array.isArray(session.messages)) {
        this.clearSession()
        return null
      }

      return session
    } catch (error) {
      console.warn('Ошибка при чтении сессии из localStorage:', error)
      this.clearSession()
      return null
    }
  }

  /**
   * Проверить не истекла ли сессия
   */
  static async isSessionExpired(session: ChatSession): Promise<boolean> {
    const settings = await this.getSettings()
    const maxAge = settings.sessionDurationHours * 60 * 60 * 1000 // часы в миллисекунды
    return Date.now() - session.lastActivity > maxAge
  }

  /**
   * Создать новую сессию
   */
  static createNewSession(): ChatSession {
    return {
      sessionId: crypto.randomUUID(),
      messages: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
    }
  }

  /**
   * Добавить сообщение в контекст
   */
  static async addMessage(
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ): Promise<void> {
    const settings = await this.getSettings()
    if (!settings.enabled) return

    let session = this.getSession()

    // Создаем новую сессию если нет или истекла
    if (!session || (await this.isSessionExpired(session))) {
      session = this.createNewSession()
    }

    const newMessage: ChatMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }

    session.messages.push(newMessage)
    session.lastActivity = Date.now()

    // Обрезаем до лимита (учитываем пары вопрос-ответ)
    const maxMessages = settings.messagesLimit * 2 // вопрос + ответ = пара
    if (session.messages.length > maxMessages) {
      session.messages = session.messages.slice(-maxMessages)
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session))
    } catch (error) {
      console.error('Ошибка при сохранении сессии:', error)
      // Если localStorage переполнен, очищаем старые сообщения
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        session.messages = session.messages.slice(-Math.floor(maxMessages / 2))
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session))
        } catch (retryError) {
          console.error(
            'Не удалось сохранить даже сокращенную сессию:',
            retryError
          )
        }
      }
    }
  }

  /**
   * Получить контекст для отправки в API
   */
  static async getContextForAPI(): Promise<ChatMessage[]> {
    const settings = await this.getSettings()
    if (!settings.enabled) return []

    const session = this.getSession()
    if (!session) return []

    // Проверяем не истекла ли сессия
    if (await this.isSessionExpired(session)) {
      this.clearSession()
      return []
    }

    // Возвращаем сообщения с учетом настройки включения источников
    return session.messages.map((msg) => ({
      ...msg,
      sources: settings.includeSources ? msg.sources : undefined,
    }))
  }

  /**
   * Очистить сессию
   */
  static clearSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.warn('Ошибка при очистке сессии:', error)
    }
  }

  /**
   * Получить количество сообщений в текущей сессии
   */
  static getMessageCount(): number {
    const session = this.getSession()
    return session ? session.messages.length : 0
  }

  /**
   * Проверить активен ли контекст
   */
  static async isContextActive(): Promise<boolean> {
    const settings = await this.getSettings()
    if (!settings.enabled) return false

    const session = this.getSession()
    if (!session) return false

    return !(await this.isSessionExpired(session))
  }

  /**
   * Получить настройки контекста из API (с кэшированием)
   */
  private static async getSettings(): Promise<ContextSettings> {
    // Проверяем кэш
    if (this.settingsCache && Date.now() < this.settingsCacheExpiry) {
      return this.settingsCache
    }

    try {
      const response = await fetch('/api/moderator/settings')
      if (!response.ok) {
        throw new Error('Failed to fetch settings')
      }

      const data = await response.json()
      const settings = data.settings

      // Извлекаем настройки контекста
      const contextSettings = settings.Chat_Context_Settings || []

      const enabled =
        this.findSetting(contextSettings, 'context_enabled')
          ?.parameter_value === 'true'
      const messagesLimit = parseInt(
        this.findSetting(contextSettings, 'context_messages_limit')
          ?.parameter_value || '5'
      )
      const sessionDurationHours = parseInt(
        this.findSetting(contextSettings, 'context_session_duration_hours')
          ?.parameter_value || '24'
      )
      const includeSources =
        this.findSetting(contextSettings, 'context_include_sources')
          ?.parameter_value === 'true'

      this.settingsCache = {
        enabled,
        messagesLimit,
        sessionDurationHours,
        includeSources,
      }

      this.settingsCacheExpiry = Date.now() + this.SETTINGS_CACHE_TTL

      return this.settingsCache
    } catch (error) {
      console.error('Ошибка при получении настроек контекста:', error)

      // Возвращаем дефолтные настройки при ошибке
      return {
        enabled: true,
        messagesLimit: 5,
        sessionDurationHours: 24,
        includeSources: false,
      }
    }
  }

  /**
   * Найти настройку по имени параметра
   */
  private static findSetting(
    settings: Array<{ parameter_name: string; parameter_value?: string }>,
    parameterName: string
  ) {
    return settings.find((s) => s.parameter_name === parameterName)
  }

  /**
   * Сбросить кэш настроек (для принудительного обновления)
   */
  static resetSettingsCache(): void {
    this.settingsCache = null
    this.settingsCacheExpiry = 0
  }
}
