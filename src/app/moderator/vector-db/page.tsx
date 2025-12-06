import Link from 'next/link'
import { headers } from 'next/headers'
import ConfirmResetButton from './ConfirmResetButton'

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
  const cfg = data?.settings || {}

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-white'>Векторная БД</h1>
          <p className='text-gray-400'>Состояние Qdrant и библиотеки</p>
        </div>
        <Link
          href='/moderator'
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
              {q.isNamedVectors && q.namedVectors
                ? `content: ${q.namedVectors.content?.size || '-'}, meta: ${
                    q.namedVectors.meta?.size || '-'
                  }`
                : String(q.vectorsSize ?? 1536)}
            </div>
            <div>
              <span className='text-gray-400'>Метрика:</span>{' '}
              {q.distance || 'Cosine'}
            </div>
            <div>
              <span className='text-gray-400'>Named Vectors:</span>{' '}
              {q.isNamedVectors ? 'включены' : 'нет'}
            </div>
            <div>
              <span className='text-gray-400'>Qdrant URL:</span>{' '}
              <span className='break-all'>{q.baseUrl || '-'}</span>
            </div>
            <div>
              <span className='text-gray-400'>Secure (HTTPS):</span>{' '}
              {q.isSecure ? 'да' : 'нет'}
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

      <div className='bg-gray-800 rounded-lg p-6 border border-gray-700'>
        <h2 className='text-lg font-semibold text-white mb-4'>
          Текущие настройки
        </h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300'>
          <div>
            <span className='text-gray-400'>Embedding Model:</span>{' '}
            {cfg.embeddingModel}
          </div>
          <div>
            <span className='text-gray-400'>Multi-Vector:</span>{' '}
            {cfg.multivectorEnabled ? 'включен' : 'выключен'}
          </div>
          <div>
            <span className='text-gray-400'>Вес контента:</span>{' '}
            {cfg.multivectorContentWeight}
          </div>
          <div>
            <span className='text-gray-400'>Вес мета-вектора:</span>{' '}
            {cfg.multivectorMetaWeight}
          </div>
        </div>
        {!q.isSecure && (
          <div className='mt-4 p-3 rounded bg-yellow-900/50 text-yellow-200 border border-yellow-700'>
            Внимание: подключение к Qdrant без HTTPS. Для облачного Qdrant
            рекомендуется использовать https:// URL.
          </div>
        )}
      </div>

      <ConfirmResetButton />
      <form action='' method='get'>
        <button className='mt-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600'>
          Обновить
        </button>
      </form>
    </div>
  )
}
