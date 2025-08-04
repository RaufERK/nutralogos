import Link from 'next/link'
import { LibraryStats } from './components/LibraryStats'
import { SyncButton } from './components/SyncButton'

export default async function AdminPage() {
  // Получаем статистику из нового API
  const response = await fetch(
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/stats`,
    {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    }
  )

  let stats = {
    totalFiles: 0,
    totalSize: 0,
    library: {
      uploaded: 0,
      embedded: 0,
      duplicateContent: 0,
      failed: 0,
    },
    syncNeeded: false,
    byFormat: {},
    processingProgress: 0,
  }

  if (response.ok) {
    const data = await response.json()
    stats = data.stats
  }

  const cards = [
    {
      title: 'Всего в библиотеке',
      value: stats.totalFiles,
      icon: '📚',
      color: 'bg-blue-500',
      href: '/admin/files',
      description: 'Уникальных файлов',
    },
    {
      title: 'В векторной БД',
      value: stats.library.embedded,
      icon: '🧠',
      color: 'bg-green-500',
      href: '/admin/files',
      description: 'Доступны для поиска',
    },
    {
      title: 'Ожидают синхронизации',
      value: stats.library.uploaded,
      icon: '⏳',
      color: stats.syncNeeded ? 'bg-orange-500' : 'bg-gray-500',
      href: '/admin/files',
      description: 'Новые файлы',
    },
    {
      title: 'Общий размер',
      value: `${(stats.totalSize / 1024 / 1024).toFixed(1)} MB`,
      icon: '💾',
      color: 'bg-purple-500',
      href: '/admin/files',
      description: 'Дисковое пространство',
    },
  ]

  return (
    <div className='space-y-6'>
      {/* Заголовок */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Библиотека знаний</h1>
          <p className='text-gray-400'>
            Двухэтапная система управления файлами
          </p>
        </div>

        {/* Прогресс-бар */}
        <div className='text-right'>
          <div className='text-sm text-gray-400 mb-1'>
            Обработано: {stats.processingProgress}%
          </div>
          <div className='w-48 bg-gray-700 rounded-full h-2'>
            <div
              className='bg-green-500 h-2 rounded-full transition-all duration-300'
              style={{ width: `${stats.processingProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className='bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow'
          >
            <div className='flex items-center'>
              <div className={`p-3 rounded-full ${card.color} text-white`}>
                <span className='text-2xl'>{card.icon}</span>
              </div>
              <div className='ml-4'>
                <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                  {card.title}
                </p>
                <p className='text-2xl font-semibold text-gray-900 dark:text-white'>
                  {card.value}
                </p>
                <p className='text-xs text-gray-400'>{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Синхронизация с векторной БД */}
      {stats.syncNeeded && (
        <div className='bg-gradient-to-r from-orange-500 to-red-500 rounded-lg shadow p-6 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold mb-2'>
                🔄 Требуется синхронизация
              </h2>
              <p className='text-orange-100 mb-4'>
                {stats.library.uploaded} файлов ожидают обработки для поиска
              </p>
            </div>
            <SyncButton pendingCount={stats.library.uploaded} />
          </div>
        </div>
      )}

      {/* Статистика библиотеки */}
      <LibraryStats stats={stats} />

      {/* Быстрые действия */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
          Быстрые действия
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          <Link
            href='/admin/upload'
            className='flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors'
          >
            <div className='p-2 bg-blue-500 text-white rounded-lg'>
              <span className='text-xl'>📤</span>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                Загрузить файл
              </p>
              <p className='text-xs text-blue-700 dark:text-blue-300'>
                Добавить новый документ
              </p>
            </div>
          </Link>

          <Link
            href='/admin/files'
            className='flex items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors'
          >
            <div className='p-2 bg-green-500 text-white rounded-lg'>
              <span className='text-xl'>📁</span>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-green-900 dark:text-green-100'>
                Управление файлами
              </p>
              <p className='text-xs text-green-700 dark:text-green-300'>
                Просмотр и управление
              </p>
            </div>
          </Link>

          <Link
            href='/admin/settings'
            className='flex items-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors'
          >
            <div className='p-2 bg-purple-500 text-white rounded-lg'>
              <span className='text-xl'>⚙️</span>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-purple-900 dark:text-purple-100'>
                Настройки системы
              </p>
              <p className='text-xs text-purple-700 dark:text-purple-300'>
                Конфигурация RAG параметров
              </p>
            </div>
          </Link>

          <Link
            href='/'
            className='flex items-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors'
          >
            <div className='p-2 bg-orange-500 text-white rounded-lg'>
              <span className='text-xl'>💬</span>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-orange-900 dark:text-orange-100'>
                Тестировать чат
              </p>
              <p className='text-xs text-orange-700 dark:text-orange-300'>
                Проверить RAG систему
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Файлы по форматам */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
          Файлы по форматам
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {Object.entries(stats.byFormat).map(([format, count]) => (
            <div
              key={format}
              className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'
            >
              <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                .{format.toLowerCase()}
              </span>
              <span className='text-sm text-gray-500 dark:text-gray-400'>
                {count} файлов
              </span>
            </div>
          ))}

          {Object.keys(stats.byFormat).length === 0 && (
            <div className='col-span-full text-center text-gray-500 dark:text-gray-400 py-4'>
              Файлы еще не загружены
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
