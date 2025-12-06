'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { data: session, status } = useSession()

  // Если пользователь уже авторизован - перенаправляем в админку
  // Middleware тоже это делает, но для клиентской навигации нужно и здесь
  useEffect(() => {
    const userRole = (session?.user as { role?: string } | undefined)?.role
    if (status === 'authenticated' && userRole === 'admin') {
      router.push('/moderator')
    }
  }, [session, status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Неверный email или пароль')
      } else if (result?.ok) {
        router.push('/moderator')
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setIsLoading(false)
    }
  }

  // Показываем загрузку пока проверяем сессию
  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-900'>
        <div className='text-white'>Загрузка...</div>
      </div>
    )
  }

  return (
    <div className='min-h-screen flex items-center justify-center p-4'>
      <div className='w-full max-w-md'>
        <div className='bg-indigo-900/70 border border-indigo-700 rounded-lg p-8 backdrop-blur-sm'>
          <div className='text-center mb-8'>
            <div className='text-4xl mb-4'>🔐</div>
            <h2 className='text-2xl font-bold text-white mb-2'>
              Вход в админ-панель
            </h2>
            <p className='text-gray-300'>RAG Chat Administration</p>
          </div>

          <form className='space-y-6' onSubmit={handleSubmit}>
            {error && (
              <div className='bg-red-900/30 border border-red-700 rounded-lg p-4'>
                <p className='text-red-300'>{error}</p>
              </div>
            )}

            <div className='space-y-4'>
              <div>
                <label
                  htmlFor='email'
                  className='block text-sm font-medium text-gray-200 mb-2'
                >
                  Email
                </label>
                <input
                  id='email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='admin@example.com'
                  className='w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 backdrop-blur-sm'
                  required
                />
              </div>
              <div>
                <label
                  htmlFor='password'
                  className='block text-sm font-medium text-gray-200 mb-2'
                >
                  Пароль
                </label>
                <input
                  id='password'
                  type='password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='••••••••'
                  className='w-full px-4 py-3 bg-gray-700/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 backdrop-blur-sm'
                  required
                />
              </div>
            </div>

            <button
              type='submit'
              disabled={isLoading}
              className='w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium'
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
