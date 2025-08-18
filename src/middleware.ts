import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  // Проверяем админские роуты
  if (pathname.startsWith('/admin')) {
    // Если пользователь уже на странице логина - пропускаем
    if (pathname === '/admin/login') {
      // Если авторизован - редирект в админку
      const role = (session?.user as { role?: string } | undefined)?.role
      if (role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      // Если не авторизован - показываем страницу логина
      return NextResponse.next()
    }

    // Для всех остальных админских страниц - проверяем авторизацию
    const userRole = (session?.user as { role?: string } | undefined)?.role
    if (!session?.user || userRole !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Защита сервисных/админских API
  const isProtectedApi =
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/vector-db') ||
    pathname === '/api/sync' ||
    pathname.startsWith('/api/settings')

  if (isProtectedApi) {
    const userRole = (session?.user as { role?: string } | undefined)?.role
    if (!session?.user || userRole !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
