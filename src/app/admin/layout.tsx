import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { auth } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Middleware уже проверил авторизацию, здесь просто получаем данные

  const navigationItems = [
    { title: 'Чат', href: '/', icon: '💬' },
    { title: 'Библиотека знаний', href: '/admin', icon: '📚' },
    { title: 'Управление файлами', href: '/admin/files', icon: '📁' },
    { title: 'Векторная БД', href: '/admin/vector-db', icon: '🗄️' },
    { title: 'Настройки системы', href: '/admin/settings', icon: '⚙️' },
  ]

  return (
    <div className='min-h-screen bg-gray-900/40 relative z-10'>
      <div
        className='fixed top-1 left-2 z-50 text-xs px-2 py-0.5 rounded'
        style={{ color: '#d1d5db', background: 'transparent' }}
        title='ENV_PATH'
      >
        {process.env.ENV_PATH || ''}
      </div>
      <nav className='bg-indigo-900 border-b border-gray-700'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between h-16'>
            <div className='flex items-center space-x-1'>
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className='text-gray-300 hover:text-white hover:bg-indigo-800 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2'
                >
                  <span>{item.icon}</span>
                  <span>{item.title}</span>
                </Link>
              ))}
            </div>
            <div className='flex items-center space-x-4'>
              <span className='text-gray-300'>{session?.user?.email}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>
      <main className='max-w-7xl mx-auto py-6 sm:px-6 lg:px-8'>{children}</main>
    </div>
  )
}
