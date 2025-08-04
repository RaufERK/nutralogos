interface LibraryStatsProps {
  stats: {
    totalFiles: number
    totalSize: number
    library: {
      uploaded: number
      embedded: number
      duplicateContent: number
      failed: number
    }
    syncNeeded: boolean
    processingProgress: number
  }
}

export function LibraryStats({ stats }: LibraryStatsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploaded':
        return '📁'
      case 'embedded':
        return '🧠'
      case 'duplicateContent':
        return '🔗'
      case 'failed':
        return '❌'
      default:
        return '📄'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
      case 'embedded':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'duplicateContent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
    }
  }

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'Загружены в библиотеку, ожидают обработки'
      case 'embedded':
        return 'Обработаны и доступны для поиска'
      case 'duplicateContent':
        return 'Содержимое дублирует другие файлы'
      case 'failed':
        return 'Ошибка при обработке'
      default:
        return 'Неизвестный статус'
    }
  }

  const statuses = [
    {
      key: 'uploaded',
      label: 'Ожидают обработки',
      count: stats.library.uploaded,
    },
    { key: 'embedded', label: 'В векторной БД', count: stats.library.embedded },
    {
      key: 'duplicateContent',
      label: 'Дубли по содержанию',
      count: stats.library.duplicateContent,
    },
    { key: 'failed', label: 'Ошибки обработки', count: stats.library.failed },
  ]

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
          📊 Детальная статистика
        </h2>
        <div className='text-sm text-gray-500 dark:text-gray-400'>
          Всего: {stats.totalFiles} файлов
        </div>
      </div>

      {/* Статусы файлов */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
        {statuses.map((status) => (
          <div
            key={status.key}
            className={`
              p-4 rounded-lg border
              ${getStatusColor(status.key)}
            `}
          >
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center space-x-2'>
                <span className='text-lg'>{getStatusIcon(status.key)}</span>
                <span className='font-medium'>{status.label}</span>
              </div>
              <span className='text-2xl font-bold'>{status.count}</span>
            </div>
            <p className='text-xs opacity-80'>
              {getStatusDescription(status.key)}
            </p>
          </div>
        ))}
      </div>

      {/* Прогресс-бар детальный */}
      <div className='space-y-3'>
        <div className='flex items-center justify-between text-sm'>
          <span className='text-gray-600 dark:text-gray-400'>
            Прогресс обработки
          </span>
          <span className='font-semibold text-gray-900 dark:text-white'>
            {stats.processingProgress}%
          </span>
        </div>

        <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3'>
          <div className='relative h-3 rounded-full overflow-hidden'>
            {/* Фон для обработанных */}
            <div
              className='absolute left-0 top-0 h-full bg-green-500 transition-all duration-500'
              style={{ width: `${stats.processingProgress}%` }}
            />

            {/* Полоска для дублей */}
            {stats.library.duplicateContent > 0 && (
              <div
                className='absolute left-0 top-0 h-full bg-blue-400 transition-all duration-500'
                style={{
                  width: `${Math.min(
                    stats.processingProgress +
                      (stats.library.duplicateContent / stats.totalFiles) * 100,
                    100
                  )}%`,
                }}
              />
            )}
          </div>
        </div>

        <div className='flex justify-between text-xs text-gray-500 dark:text-gray-400'>
          <span>0 файлов</span>
          <span>{stats.totalFiles} файлов</span>
        </div>
      </div>

      {/* Дополнительная информация */}
      <div className='mt-6 pt-4 border-t border-gray-200 dark:border-gray-700'>
        <div className='grid grid-cols-2 gap-4 text-sm'>
          <div>
            <span className='text-gray-500 dark:text-gray-400'>
              Размер библиотеки:
            </span>
            <span className='ml-2 font-semibold text-gray-900 dark:text-white'>
              {(stats.totalSize / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <div>
            <span className='text-gray-500 dark:text-gray-400'>
              Требует синхронизации:
            </span>
            <span
              className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                stats.syncNeeded
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
                  : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              }`}
            >
              {stats.syncNeeded ? 'Да' : 'Нет'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
