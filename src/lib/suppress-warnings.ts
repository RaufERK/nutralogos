// Временное подавление warning сообщений для демонстрации
// Удалить этот файл после презентации

if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const originalWarn = console.warn
  const originalError = console.error

  // Фильтруем известные warning сообщения от PDF библиотек
  const suppressPatterns = [
    'Warning:',
    'Unsupported',
    'NOT valid',
    'Type3 font',
    'fake worker',
    'field.type',
    'form element',
    'Link',
    'Glyph',
    'pdfjs',
    'pdf2json',
  ]

  console.warn = (...args: unknown[]) => {
    const msg = args[0]?.toString() || ''
    if (suppressPatterns.some((pattern) => msg.includes(pattern))) {
      return
    }
    originalWarn(...(args as []))
  }

  console.error = (...args: unknown[]) => {
    const msg = args[0]?.toString() || ''
    // Не подавляем критические ошибки, только PDF warnings
    if (
      msg.includes('Warning:') &&
      suppressPatterns.some((pattern) => msg.includes(pattern))
    ) {
      return
    }
    originalError(...(args as []))
  }
}

export {}
