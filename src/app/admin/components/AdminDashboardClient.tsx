'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { LibraryStats } from './LibraryStats'
import { SyncButton } from './SyncButton'
import UploadPage from '../components/UploadWidget'

type SystemStats = {
  totalFiles: number
  totalSize: number
  library: {
    uploaded: number
    embedded: number
    duplicateContent: number
    failed: number
  }
  syncNeeded: boolean
  byFormat: Record<string, number>
  processingProgress: number
}

export default function AdminDashboardClient() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [clearSignal, setClearSignal] = useState(0)
  const [syncInProgress, setSyncInProgress] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      const data = await res.json()
      if (data?.success && data.stats) setStats(data.stats as SystemStats)
    } catch {
      // noop
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (!syncInProgress) return
    const id = setInterval(() => {
      fetchStats()
    }, 3000)
    return () => clearInterval(id)
  }, [syncInProgress, fetchStats])

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Библиотека знаний</h1>
          <p className='text-gray-400'>
            Двухэтапная система управления файлами
          </p>
        </div>
        <div className='text-right'>
          <div className='text-sm text-gray-400 mb-1'>
            Обработано: {stats?.processingProgress ?? 0}%
          </div>
          <div className='w-48 bg-gray-700 rounded-full h-2'>
            <div
              className='bg-green-500 h-2 rounded-full transition-all duration-300'
              style={{ width: `${stats?.processingProgress ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Встроенная загрузка файлов (компакт) */}
      <div className='bg-white/5 rounded-lg border border-white/10 p-4'>
        <UploadPage
          variant='compact'
          hideHeader
          onLibraryChanged={fetchStats}
          clearSignal={clearSignal}
        />
      </div>

      {/* Если нужна синхронизация */}
      {
        <div className='bg-gradient-to-r from-orange-500 to-red-500 rounded-lg shadow p-4 md:p-6 text-white'>
          <div className='flex items-center justify-between'>
            <div className='text-sm'>
              {syncInProgress
                ? 'Идёт синхронизация…'
                : 'Готово к синхронизации'}
            </div>
            <div className='text-sm'>
              Ожидают: {stats?.library.uploaded ?? 0}
            </div>
          </div>
          <div className='mt-3'>
            <SyncButton
              pendingCount={stats?.library.uploaded ?? 0}
              onStart={() => setSyncInProgress(true)}
              onSynced={() => {
                setSyncInProgress(false)
                fetchStats()
                setClearSignal((v) => v + 1)
              }}
            />
          </div>
          {syncInProgress && (
            <div className='mt-3'>
              <div className='w-full bg-white/20 rounded-full h-2'>
                <div
                  className='bg-white h-2 rounded-full transition-all duration-500'
                  style={{ width: `${stats?.processingProgress ?? 0}%` }}
                />
              </div>
              <div className='mt-1 text-xs opacity-90'>
                Прогресс: {stats?.processingProgress ?? 0}%
              </div>
            </div>
          )}
        </div>
      }

      {/* Статистика */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        {[
          {
            title: 'Всего в библиотеке',
            value: stats?.totalFiles ?? 0,
            icon: '📚',
            color: 'bg-blue-500',
            href: '/admin/files',
            description: 'Уникальных файлов',
          },
          {
            title: 'В векторной БД',
            value: stats?.library.embedded ?? 0,
            icon: '🧠',
            color: 'bg-green-500',
            href: '/admin/files',
            description: 'Доступны для поиска',
          },
          {
            title: 'Ожидают синхронизации',
            value: stats?.library.uploaded ?? 0,
            icon: '⏳',
            color: (stats?.syncNeeded
              ? 'bg-orange-500'
              : 'bg-gray-500') as string,
            href: '/admin/files',
            description: 'Новые файлы',
          },
          {
            title: 'Общий размер',
            value: `${((stats?.totalSize ?? 0) / 1024 / 1024 || 0).toFixed(
              1
            )} MB`,
            icon: '💾',
            color: 'bg-purple-500',
            href: '/admin/files',
            description: 'Дисковое пространство',
          },
        ].map((card) => (
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
                  {card.value as unknown as string}
                </p>
                <p className='text-xs text-gray-400'>{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Детальная статистика */}
      {stats && <LibraryStats stats={stats} />}

      {/* Файлы по форматам */}
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow p-6'>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
          Файлы по форматам
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          {stats &&
            Object.entries(stats.byFormat).map(([format, count]) => (
              <div
                key={format}
                className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'
              >
                <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  .{format.toLowerCase()}
                </span>
                <span className='text-sm text-gray-500 dark:text-gray-400'>
                  {String(count)} файлов
                </span>
              </div>
            ))}

          {stats && Object.keys(stats.byFormat).length === 0 && (
            <div className='col-span-full text-center text-gray-500 dark:text-gray-400 py-4'>
              Файлы еще не загружены
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
