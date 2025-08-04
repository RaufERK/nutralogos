import Database from 'better-sqlite3'
import { join } from 'path'

let db: Database.Database | null = null

export async function getDatabase(): Promise<Database.Database> {
  if (!db) {
    const dbPath = join(process.cwd(), 'data', 'rag-chat.db')
    db = new Database(dbPath)

    // Enable foreign keys
    db.pragma('foreign_keys = ON')

    // Initialize tables
    await initializeTables()
  }

  return db
}

async function initializeTables() {
  const database = await getDatabase()

  // Create files table
  database.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_hash TEXT UNIQUE NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      chunks_count INTEGER DEFAULT 0,
      qdrant_points TEXT,
      error_message TEXT,
      metadata TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create system settings table for configurable parameters
  database.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Основные поля
      category TEXT NOT NULL,                    -- 'ai', 'search', 'content', 'security'  
      parameter_name TEXT NOT NULL,
      parameter_value TEXT NOT NULL,
      default_value TEXT NOT NULL,
      
      -- Метаданные параметра
      parameter_type TEXT NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
      validation_rule TEXT,                      -- JSON с правилами валидации
      display_name TEXT NOT NULL,                -- Человеко-читаемое название
      description TEXT,                          -- Описание параметра
      help_text TEXT,                           -- Подсказка для админа
      
      -- UI отображение
      ui_component TEXT DEFAULT 'input',         -- 'input', 'select', 'slider', 'toggle', 'textarea'
      ui_options TEXT,                          -- JSON с опциями для select/slider
      ui_order INTEGER DEFAULT 0,               -- Порядок отображения в группе
      
      -- Управление изменениями
      requires_restart BOOLEAN DEFAULT FALSE,    -- Требует ли перезапуск системы
      is_sensitive BOOLEAN DEFAULT FALSE,        -- Чувствительный параметр (пароли, ключи)
      is_readonly BOOLEAN DEFAULT FALSE,         -- Только для чтения
      
      -- Аудит
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT,                          -- ID пользователя, который обновил
      
      UNIQUE(category, parameter_name)
    )
  `)

  // Create setting changes history table
  database.exec(`
    CREATE TABLE IF NOT EXISTS setting_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_id INTEGER REFERENCES system_settings(id) ON DELETE CASCADE,
      old_value TEXT,
      new_value TEXT NOT NULL,
      changed_by TEXT NOT NULL,                 -- ID пользователя
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      change_reason TEXT                        -- Причина изменения
    )
  `)

  // Create users table for role-based access
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Основная информация
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      password_hash TEXT,                    -- Для локальной авторизации
      
      -- Роли и права
      role TEXT NOT NULL DEFAULT 'editor',   -- 'admin', 'editor', 'user'
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive', 'suspended'
      
      -- OAuth данные (NextAuth.js)
      provider TEXT,                         -- 'google', 'github', 'credentials'
      provider_id TEXT,                      -- ID от OAuth провайдера
      
      -- Персональные данные  
      first_name TEXT,
      last_name TEXT,
      avatar_url TEXT,
      
      -- Метаданные
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME,
      
      -- Аудит
      created_by INTEGER REFERENCES users(id), -- Кто создал пользователя
      updated_by INTEGER REFERENCES users(id)  -- Кто последний раз обновлял
    )
  `)

  // Create processed files table for hash-based deduplication
  database.exec(`
    CREATE TABLE IF NOT EXISTS processed_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_hash TEXT UNIQUE NOT NULL,           -- SHA-256 хеш файла
      txt_hash TEXT,                            -- SHA-256 хеш текстового содержимого
      original_filename TEXT NOT NULL,          -- Оригинальное имя файла
      original_format TEXT NOT NULL,            -- Формат файла (расширение)
      file_size INTEGER NOT NULL,               -- Размер в байтах
      mime_type TEXT NOT NULL,                  -- MIME тип файла
      
      -- Статусы: 'original_uploaded', 'txt_ready', 'embedded', 'duplicate_content', 'failed'
      processing_status TEXT DEFAULT 'original_uploaded',
      
      -- Пути к файлам
      storage_path TEXT NOT NULL,               -- Путь к оригинальному файлу
      txt_path TEXT,                            -- Путь к txt файлу
      meta_path TEXT,                           -- Путь к метаданным (будет удален)
      
      -- Метаданные содержимого
      text_length INTEGER,                      -- Длина текста в символах
      language TEXT DEFAULT 'ru',               -- Язык документа
      chunks_created INTEGER DEFAULT 0,         -- Количество созданных chunks
      processing_time_ms INTEGER,               -- Время обработки в миллисекундах
      
      -- Сообщения об ошибках
      error_message TEXT,                       -- Сообщение об ошибке, если есть
      
      -- Временные метки
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,                    -- Когда завершена обработка txt
      embedded_at DATETIME,                     -- Когда создан эмбеддинг
      
      -- Аудит
      uploaded_by INTEGER REFERENCES users(id), -- Кто загрузил
      
      -- Дополнительные метаданные (JSON)
      metadata_json TEXT                        -- JSON с дополнительными данными
    )
  `)

  // Create file chunks table
  database.exec(`
    CREATE TABLE IF NOT EXISTS file_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      processed_file_id INTEGER REFERENCES processed_files(id) ON DELETE CASCADE,
      qdrant_point_id TEXT NOT NULL,            -- ID точки в Qdrant
      chunk_index INTEGER NOT NULL,             -- Порядковый номер chunk'а в файле
      chunk_text TEXT NOT NULL,                 -- Текст chunk'а
      chunk_size INTEGER NOT NULL,              -- Размер chunk'а в символах
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      UNIQUE(processed_file_id, chunk_index)
    )
  `)

  // Create indexes
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
    CREATE INDEX IF NOT EXISTS idx_system_settings_name ON system_settings(parameter_name);
    CREATE INDEX IF NOT EXISTS idx_setting_changes_setting_id ON setting_changes(setting_id);
    CREATE INDEX IF NOT EXISTS idx_setting_changes_changed_at ON setting_changes(changed_at);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_processed_files_hash ON processed_files(file_hash);
    CREATE INDEX IF NOT EXISTS idx_processed_files_txt_hash ON processed_files(txt_hash);
    CREATE INDEX IF NOT EXISTS idx_processed_files_status ON processed_files(processing_status);
    CREATE INDEX IF NOT EXISTS idx_processed_files_uploaded_by ON processed_files(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_processed_files_format ON processed_files(original_format);
    CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(processed_file_id);
    CREATE INDEX IF NOT EXISTS idx_file_chunks_qdrant_id ON file_chunks(qdrant_point_id);
  `)

  // Initialize default system settings
  await initializeDefaultSettings()
}

async function initializeDefaultSettings() {
  const database = await getDatabase()

  const defaultSettings = [
    // AI Model Settings
    {
      category: 'ai',
      parameter_name: 'openai_chat_model',
      parameter_value: 'gpt-4o',
      default_value: 'gpt-4o',
      parameter_type: 'string',
      display_name: 'OpenAI Chat Model',
      description: 'Модель OpenAI для генерации ответов',
      help_text: 'Выберите модель: gpt-4o, gpt-3.5-turbo, gpt-4-turbo',
      ui_component: 'select',
      ui_options: JSON.stringify(['gpt-4o', 'gpt-3.5-turbo', 'gpt-4-turbo']),
      ui_order: 1,
    },
    {
      category: 'ai',
      parameter_name: 'temperature',
      parameter_value: '0.4',
      default_value: '0.4',
      parameter_type: 'number',
      display_name: 'Temperature',
      description: 'Креативность ответов (0.0-2.0)',
      help_text: '0.0 = очень точные ответы, 2.0 = очень креативные',
      ui_component: 'slider',
      ui_options: JSON.stringify({ min: 0, max: 2, step: 0.1 }),
      ui_order: 2,
    },
    {
      category: 'ai',
      parameter_name: 'max_tokens',
      parameter_value: '4000',
      default_value: '4000',
      parameter_type: 'number',
      display_name: 'Max Tokens',
      description: 'Максимальная длина ответа',
      help_text: 'Максимальное количество токенов в ответе',
      ui_component: 'input',
      ui_options: JSON.stringify({ type: 'number', min: 100, max: 8000 }),
      ui_order: 3,
    },

    // Search & Retrieval Settings
    {
      category: 'search',
      parameter_name: 'retrieval_k',
      parameter_value: '8',
      default_value: '8',
      parameter_type: 'number',
      display_name: 'Retrieval K',
      description: 'Количество документов для поиска',
      help_text: 'Сколько документов искать при запросе',
      ui_component: 'input',
      ui_options: JSON.stringify({ type: 'number', min: 1, max: 20 }),
      ui_order: 1,
    },
    {
      category: 'search',
      parameter_name: 'score_threshold',
      parameter_value: '0.3',
      default_value: '0.3',
      parameter_type: 'number',
      display_name: 'Score Threshold',
      description: 'Минимальный порог сходства (0.0-1.0)',
      help_text: 'Минимальный score для включения документа в контекст',
      ui_component: 'slider',
      ui_options: JSON.stringify({ min: 0, max: 1, step: 0.05 }),
      ui_order: 2,
    },
    {
      category: 'search',
      parameter_name: 'rerank_enabled',
      parameter_value: 'true',
      default_value: 'true',
      parameter_type: 'boolean',
      display_name: 'Enable Re-ranking',
      description: 'Включить переранжирование документов',
      help_text: 'Использовать кастомную логику переранжирования',
      ui_component: 'toggle',
      ui_order: 3,
    },

    // Content Settings
    {
      category: 'content',
      parameter_name: 'spiritual_prompt_enabled',
      parameter_value: 'true',
      default_value: 'true',
      parameter_type: 'boolean',
      display_name: 'Spiritual Prompt',
      description: 'Использовать духовный промпт',
      help_text: 'Специализированный промпт для духовных вопросов',
      ui_component: 'toggle',
      ui_order: 1,
    },
    {
      category: 'content',
      parameter_name: 'context_max_length',
      parameter_value: '8000',
      default_value: '8000',
      parameter_type: 'number',
      display_name: 'Context Max Length',
      description: 'Максимальная длина контекста',
      help_text: 'Максимальное количество символов в контексте',
      ui_component: 'input',
      ui_options: JSON.stringify({ type: 'number', min: 1000, max: 10000 }),
      ui_order: 2,
    },

    // Security Settings
    {
      category: 'security',
      parameter_name: 'requests_per_minute',
      parameter_value: '60',
      default_value: '60',
      parameter_type: 'number',
      display_name: 'Requests per Minute',
      description: 'Лимит запросов в минуту',
      help_text: 'Максимальное количество запросов в минуту на пользователя',
      ui_component: 'input',
      ui_options: JSON.stringify({ type: 'number', min: 1, max: 100 }),
      ui_order: 1,
    },
    {
      category: 'security',
      parameter_name: 'max_file_size_mb',
      parameter_value: '50',
      default_value: '50',
      parameter_type: 'number',
      display_name: 'Max File Size (MB)',
      description: 'Максимальный размер файла в мегабайтах',
      help_text: 'Максимальный размер загружаемого файла',
      ui_component: 'input',
      ui_options: JSON.stringify({ type: 'number', min: 1, max: 100 }),
      ui_order: 2,
    },
  ]

  for (const setting of defaultSettings) {
    try {
      database
        .prepare(
          `
        INSERT OR IGNORE INTO system_settings (
          category, parameter_name, parameter_value, default_value,
          parameter_type, display_name, description, help_text,
          ui_component, ui_options, ui_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          setting.category,
          setting.parameter_name,
          setting.parameter_value,
          setting.default_value,
          setting.parameter_type,
          setting.display_name,
          setting.description,
          setting.help_text,
          setting.ui_component,
          setting.ui_options,
          setting.ui_order
        )
    } catch (error) {
      console.warn(`Failed to insert setting ${setting.parameter_name}:`, error)
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    db.close()
    db = null
  }
}
