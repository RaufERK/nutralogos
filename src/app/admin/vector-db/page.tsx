import Link from 'next/link'
import { headers } from 'next/headers'

async function getStats() {
  const h = await headers()
  const host = h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || 'http'
  const base = `${proto}://${host}`
  const res = await fetch(`${base}/api/vector-db/stats`, { cache: 'no-store' })
  return res.json()
}

export default async function VectorDBPage() {
  const data = await getStats()
  const q = data?.qdrant || {}
  const s = data?.sqlite || { totalFiles: 0, byStatus: {} }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Векторная БД</h1>
          <p className='text-gray-400'>Состояние Qdrant и библиотеки</p>
        </div>
        <Link
          href='/admin'
          className='px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors'
        >
          Назад к дашборду
        </Link>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <div className='bg-gray-800 rounded-lg p-6 border border-gray-700'>
          <h2 className='text-lg font-semibold text-white mb-4'>Qdrant</h2>
          <div className='space-y-2 text-gray-300'>
            <div>
              <span className='text-gray-400'>Коллекция:</span>{' '}
              {q.collection || 'nutralogos'}
            </div>
            <div>
              <span className='text-gray-400'>Доступность:</span>{' '}
              {q.available ? 'доступна' : 'недоступна'}
            </div>
            <div>
              <span className='text-gray-400'>Существует:</span>{' '}
              {q.exists ? 'да' : 'нет'}
            </div>
            <div>
              <span className='text-gray-400'>Векторов:</span>{' '}
              {String(q.pointsCount ?? 0)}
            </div>
            <div>
              <span className='text-gray-400'>Размерность:</span>{' '}
              {String(q.vectorsSize ?? 1536)}
            </div>
            <div>
              <span className='text-gray-400'>Метрика:</span>{' '}
              {q.distance || 'Cosine'}
            </div>
          </div>
        </div>

        <div className='bg-gray-800 rounded-lg p-6 border border-gray-700'>
          <h2 className='text-lg font-semibold text-white mb-4'>Библиотека</h2>
          <div className='space-y-2 text-gray-300'>
            <div>
              <span className='text-gray-400'>Всего файлов:</span>{' '}
              {String(s.totalFiles)}
            </div>
            {[
              'original_uploaded',
              'embedded',
              'duplicate_content',
              'failed',
            ].map((k) => (
              <div key={k}>
                <span className='text-gray-400'>{k}:</span>{' '}
                {String(s.byStatus?.[k] || 0)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <form
        action={async () => {
          'use server'
          const h = await headers()
          const host = h.get('host') || 'localhost:3000'
          const proto = h.get('x-forwarded-proto') || 'http'
          const base = `${proto}://${host}`
          await fetch(`${base}/api/vector-db/drop`, { method: 'POST' })
        }}
      >
        <button
          type='submit'
          className='px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors border border-red-500'
        >
          Удалить все записи
        </button>
      </form>
    </div>
  )
}
