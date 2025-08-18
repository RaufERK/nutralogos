import { getDatabase } from './database'

export interface SystemSetting {
  id: number
  category: string
  parameter_name: string
  parameter_value: string
  default_value: string
  parameter_type: 'string' | 'number' | 'boolean' | 'json'
  display_name: string
  description?: string
  help_text?: string
  ui_component: 'input' | 'select' | 'slider' | 'toggle' | 'textarea'
  ui_options?: string
  ui_order: number
  requires_restart: boolean
  is_sensitive: boolean
  is_readonly: boolean
  created_at: string
  updated_at: string
  updated_by?: string
}

export interface SettingChange {
  id: number
  setting_id: number
  old_value?: string
  new_value: string
  changed_by: string
  changed_at: string
  change_reason?: string
}

export interface SettingsByCategory {
  [category: string]: SystemSetting[]
}

/**
 * Service for managing system settings from database
 * Provides caching and validation for better performance
 */
export class SettingsService {
  private static cache: Map<string, SystemSetting> = new Map()
  private static cacheExpiry: number = 0
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get all settings grouped by category
   */
  static async getAllSettings(): Promise<SettingsByCategory> {
    const database = await getDatabase()

    const settings = database
      .prepare(
        `
      SELECT * FROM system_settings 
      ORDER BY category, ui_order, parameter_name
    `
      )
      .all() as SystemSetting[]

    const grouped: SettingsByCategory = {}

    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = []
      }
      grouped[setting.category].push(setting)
    }

    return grouped
  }

  /**
   * Get setting by name with caching
   */
  static async getSetting(
    parameterName: string
  ): Promise<SystemSetting | null> {
    // Check cache first
    if (this.isCacheValid() && this.cache.has(parameterName)) {
      return this.cache.get(parameterName)!
    }

    const database = await getDatabase()

    const setting = database
      .prepare(
        `
      SELECT * FROM system_settings WHERE parameter_name = ?
    `
      )
      .get(parameterName) as SystemSetting | undefined

    if (setting) {
      this.cache.set(parameterName, setting)
    }

    return setting || null
  }

  /**
   * Get setting value with type conversion
   */
  static async getSettingValue<T = string>(
    parameterName: string,
    defaultValue?: T
  ): Promise<T> {
    const setting = await this.getSetting(parameterName)

    if (!setting) {
      return defaultValue as T
    }

    return this.convertValue(
      setting.parameter_value,
      setting.parameter_type
    ) as T
  }

  /**
   * Update setting value
   */
  static async updateSetting(
    parameterName: string,
    newValue: string,
    userId: string,
    reason?: string
  ): Promise<boolean> {
    const database = await getDatabase()

    // Get current setting
    const currentSetting = await this.getSetting(parameterName)
    if (!currentSetting) {
      throw new Error(`Setting ${parameterName} not found`)
    }

    // Validate new value
    if (!this.validateValue(newValue, currentSetting)) {
      throw new Error(`Invalid value for setting ${parameterName}`)
    }

    // Start transaction
    const transaction = database.transaction(() => {
      // Update setting
      const result = database
        .prepare(
          `
        UPDATE system_settings 
        SET parameter_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE parameter_name = ?
      `
        )
        .run(newValue, userId, parameterName)

      if (result.changes === 0) {
        throw new Error(`Failed to update setting ${parameterName}`)
      }

      // Log change
      database
        .prepare(
          `
        INSERT INTO setting_changes (
          setting_id, old_value, new_value, changed_by, change_reason
        ) VALUES (?, ?, ?, ?, ?)
      `
        )
        .run(
          currentSetting.id,
          currentSetting.parameter_value,
          newValue,
          userId,
          reason || 'Updated via admin interface'
        )

      return true
    })

    try {
      const success = transaction()

      // Invalidate cache
      this.invalidateCache()

      return success
    } catch (error) {
      console.error('Failed to update setting:', error)
      throw error
    }
  }

  /**
   * Get settings by category
   */
  static async getSettingsByCategory(
    category: string
  ): Promise<SystemSetting[]> {
    const database = await getDatabase()

    return database
      .prepare(
        `
      SELECT * FROM system_settings 
      WHERE category = ? 
      ORDER BY ui_order, parameter_name
    `
      )
      .all(category) as SystemSetting[]
  }

  /**
   * Get setting change history
   */
  static async getSettingHistory(
    parameterName: string,
    limit: number = 10
  ): Promise<SettingChange[]> {
    const database = await getDatabase()

    return database
      .prepare(
        `
      SELECT sc.* FROM setting_changes sc
      JOIN system_settings ss ON sc.setting_id = ss.id
      WHERE ss.parameter_name = ?
      ORDER BY sc.changed_at DESC
      LIMIT ?
    `
      )
      .all(parameterName, limit) as SettingChange[]
  }

  /**
   * Reset setting to default value
   */
  static async resetSetting(
    parameterName: string,
    userId: string
  ): Promise<boolean> {
    const setting = await this.getSetting(parameterName)
    if (!setting) {
      throw new Error(`Setting ${parameterName} not found`)
    }

    return this.updateSetting(
      parameterName,
      setting.default_value,
      userId,
      'Reset to default value'
    )
  }

  /**
   * Get all settings that require restart
   */
  static async getSettingsRequiringRestart(): Promise<SystemSetting[]> {
    const database = await getDatabase()

    return database
      .prepare(
        `
      SELECT * FROM system_settings 
      WHERE requires_restart = TRUE
      ORDER BY category, ui_order
    `
      )
      .all() as SystemSetting[]
  }

  /**
   * Convert string value to appropriate type
   */
  private static convertValue(value: string, type: string): unknown {
    switch (type) {
      case 'number':
        return parseFloat(value)
      case 'boolean':
        return value.toLowerCase() === 'true'
      case 'json':
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      default:
        return value
    }
  }

  /**
   * Validate value against setting constraints
   */
  private static validateValue(value: string, setting: SystemSetting): boolean {
    try {
      const convertedValue = this.convertValue(value, setting.parameter_type)

      // Basic type validation
      switch (setting.parameter_type) {
        case 'number': {
          if (
            !(typeof convertedValue === 'number') ||
            Number.isNaN(convertedValue)
          ) {
            return false
          }
          break
        }
        case 'boolean':
          if (typeof convertedValue !== 'boolean') return false
          break
        case 'json':
          if (typeof convertedValue !== 'object') return false
          break
      }

      // Additional validation rules could be added here
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if cache is still valid
   */
  private static isCacheValid(): boolean {
    return Date.now() < this.cacheExpiry
  }

  /**
   * Invalidate cache
   */
  private static invalidateCache(): void {
    this.cache.clear()
    this.cacheExpiry = 0
  }

  /**
   * Refresh cache
   */
  private static refreshCache(): void {
    this.cacheExpiry = Date.now() + this.CACHE_TTL
  }
}

/**
 * Convenience functions for common settings
 */
export class RAGSettings {
  /**
   * Get AI model settings
   */
  static async getAIModel(): Promise<string> {
    return SettingsService.getSettingValue('openai_chat_model', 'gpt-4o')
  }

  static async getTemperature(): Promise<number> {
    return SettingsService.getSettingValue('temperature', 0.4)
  }

  static async getMaxTokens(): Promise<number> {
    return SettingsService.getSettingValue('max_tokens', 4000)
  }

  /**
   * Get search settings
   */
  static async getRetrievalK(): Promise<number> {
    return SettingsService.getSettingValue('retrieval_k', 8)
  }

  static async getScoreThreshold(): Promise<number> {
    return SettingsService.getSettingValue('score_threshold', 0.3)
  }

  static async isRerankEnabled(): Promise<boolean> {
    return SettingsService.getSettingValue('rerank_enabled', true)
  }

  /**
   * Get content settings
   */
  static async isSpiritualPromptEnabled(): Promise<boolean> {
    // Deprecated: always false
    return false
  }

  static async getContextMaxLength(): Promise<number> {
    return SettingsService.getSettingValue('context_max_length', 8000)
  }

  /**
   * Get security settings
   */
  static async getRequestsPerMinute(): Promise<number> {
    return SettingsService.getSettingValue('requests_per_minute', 60)
  }

  static async getMaxFileSizeMB(): Promise<number> {
    return SettingsService.getSettingValue('max_file_size_mb', 50)
  }

  static async getChatWelcomeMessage(): Promise<string> {
    const defaultMessage = `Этот чат-помощник создан, чтобы помогать вам находить ответы на вопросы о здоровье, питании и нутрициологической поддержке.

Задайте вопрос — и я подберу для вас наиболее точную и полезную информацию из нашей экспертной базы знаний.`

    return SettingsService.getSettingValue(
      'chat_welcome_message',
      defaultMessage
    )
  }

  static async getSystemPrompt(): Promise<string> {
    const defaultPrompt = `Ты — профессиональный ассистент нутрициолога.

Твоя задача — помогать пользователю находить обоснованные и полезные ответы по темам здоровья, питания, витаминов, микро- и макроэлементов, добавок, образа жизни и нутрицевтической поддержки.

Основные принципы работы:

Работаешь строго в рамках нутрициологии.
Не ставишь диагнозы, не предлагаешь медикаментозное лечение. В медицинских вопросах рекомендуешь обращаться к врачу.

Опираешься на доказательную базу.
Используешь научные данные, клинические рекомендации и надёжные источники, если они доступны. Если есть противоречия в исследованиях — указываешь это.

Отвечаешь ясно и уважительно.
Тон общения — профессиональный, дружелюбный и поддерживающий. Не пугаешь пользователя, не делаешь резких выводов, не оцениваешь внешность или образ жизни.

Учитываешь контекст и уточняешь при необходимости.
Если вопрос неоднозначен или требует уточнений (возраст, пол, диагнозы, препараты и т.п.) — вежливо спрашиваешь.

При ответах фокусируешься на:

витаминах и минералах,

пищевых добавках,

питательных веществах и их усвоении,

пищеварении и ЖКТ,

гормональном фоне (в рамках нутрициологии),

диетах, образе жизни, режиме питания,

поддержке при хронических состояниях (в рамках компетенций нутрициолога).

Если не уверен в чём-то — честно указываешь это и предлагаешь безопасные общие рекомендации или направление для обсуждения со специалистом.`

    return SettingsService.getSettingValue('system_prompt', defaultPrompt)
  }
}
