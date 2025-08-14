'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfirmResetButton() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleDelete = async () => {
    setError('')
    setSuccess('')
    startTransition(async () => {
      try {
        const res = await fetch('/api/vector-db/drop', { method: 'POST' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.success === false) {
          setError(data?.error || 'Не удалось удалить записи')
          return
        }
        setSuccess('Коллекция очищена, статусы файлов сброшены')
        setConfirming(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка удаления')
      }
    })
  }

  return (
    <div className='space-y-3'>
      {!confirming ? (
        <button
          type='button'
          onClick={() => setConfirming(true)}
          className='px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors border border-red-500'
        >
          Удалить все записи
        </button>
      ) : (
        <div className='rounded-lg border border-red-500/40 bg-red-900/20 p-4'>
          <div className='text-red-200 mb-3'>
            Действие необратимо: будут удалены все эмбеддинги в Qdrant, а
            статусы файлов будут сброшены. Продолжить?
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={handleDelete}
              disabled={isPending}
              className='px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-700/60 transition-colors'
            >
              Да, удалить все записи
            </button>
            <button
              type='button'
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className='px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-700/60 transition-colors'
            >
              Отмена
            </button>
          </div>
          {error && <div className='text-red-300 text-sm mt-3'>{error}</div>}
          {success && (
            <div className='text-green-300 text-sm mt-3'>{success}</div>
          )}
        </div>
      )}
    </div>
  )
}
