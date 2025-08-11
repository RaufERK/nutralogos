export const FILE_CONFIG = {
  // Пути
  UPLOADS_DIR: 'uploads',
  TEMP_DIR: 'uploads/temp',
  PROCESSING_DIR: 'uploads/temp/processing',
  CLEANUP_DIR: 'uploads/temp/cleanup',
  BACKUPS_DIR: 'uploads/backups',
  LOGS_DIR: 'uploads/logs',

  // Ограничения
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB - reduced for stability
  MAX_FILES_PER_DAY: 50, // Reduced for stability
  ALLOWED_MIME_TYPES: [
    'application/pdf', // ✅ PDF - через pdf-text-extract
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // ✅ DOCX - через mammoth
    'text/plain', // ✅ TXT - нативный Node.js
    // legacy formats (epub/fb2/xml) removed
    'application/msword', // ✅ DOC - через word-extractor
    'application/vnd.ms-word', // ✅ DOC альтернативный MIME - через word-extractor
  ],

  // Настройки чанкинга - ОПТИМИЗИРОВАНЫ согласно рекомендациям OpenAI
  CHUNK_SIZE: parseInt(process.env.CHUNK_SIZE || '3000'), // символов - оптимизировано для ~1000 токенов
  CHUNK_OVERLAP: parseInt(process.env.CHUNK_OVERLAP || '600'), // символов - 20% от размера чанка
  chunkSize: parseInt(process.env.CHUNK_SIZE || '3000'), // для совместимости
  chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '600'), // для совместимости

  // Очистка
  CLEANUP_DAYS: 7, // Удалять файлы старше 7 дней - уменьшено
  BACKUP_DAYS: 3, // Хранить бэкапы 3 дня - уменьшено

  // Валидация
  MIN_FILE_SIZE: 1024, // 1KB
  MAX_FILENAME_LENGTH: 255,

  // Новые ограничения - ОПТИМИЗИРОВАНЫ для больших чанков
  MAX_CHUNKS_PER_FILE: 50, // Максимум чанков на файл (увеличено)
  MAX_TEXT_LENGTH: 200000, // Максимум символов в тексте (увеличено для больших файлов)
} as const

export type AllowedMimeType = (typeof FILE_CONFIG.ALLOWED_MIME_TYPES)[number]
