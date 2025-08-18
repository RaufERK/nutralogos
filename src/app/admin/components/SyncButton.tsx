'use client'

import { useState } from 'react'

interface SyncButtonProps {
  pendingCount: number
  onSynced?: () => void
  onStart?: () => void
}

export function SyncButton({
  pendingCount,
  onSynced,
  onStart,
}: SyncButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    processed?: number
    skipped?: number
    errors?: number
    error?: string
    details?: string
  } | null>(null)

  const handleSync = async () => {
    onStart?.()
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      setResult(data)

      if (data.success) onSynced?.()
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error',
        details: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='flex flex-col items-end space-y-2'>
      <button
        onClick={handleSync}
        disabled={isLoading || pendingCount === 0}
        className={`
          px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200
          ${
            isLoading
              ? 'bg-gray-600 cursor-not-allowed'
              : pendingCount > 0
              ? 'bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30'
              : 'bg-gray-600 cursor-not-allowed'
          }
        `}
      >
        {isLoading ? (
          <div className='flex items-center space-x-2'>
            <div className='animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full' />
            <span>Синхронизация...</span>
          </div>
        ) : (
          `🔄 Синхронизировать (${pendingCount})`
        )}
      </button>

      {/* Результат операции */}
      {result && (
        <div
          className={`
            text-sm p-3 rounded-lg backdrop-blur-sm border max-w-md
            ${
              result.success
                ? 'bg-green-500/20 border-green-400/30 text-green-100'
                : 'bg-red-500/20 border-red-400/30 text-red-100'
            }
          `}
        >
          {result.success ? (
            <div>
              <div className='font-semibold'>✅ Синхронизация завершена</div>
              <div className='mt-1'>
                • Обработано: {result.processed}
                <br />• Пропущено (дубли): {result.skipped}
                <br />• Ошибки: {result.errors}
              </div>
              <div className='text-xs mt-2 opacity-80'>
                Страница обновится автоматически...
              </div>
            </div>
          ) : (
            <div>
              <div className='font-semibold'>❌ Ошибка синхронизации</div>
              <div className='mt-1 text-xs'>{result.error}</div>
              {result.details && (
                <div className='mt-1 text-xs opacity-80'>{result.details}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
