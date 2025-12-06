import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl
  const method = request.method
  const isApi = pathname.startsWith('/api')

  const allowOrigin = request.headers.get('origin') || '*'
  const baseHeaders: Record<string, string> = isApi
    ? {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers':
          request.headers.get('access-control-request-headers') ||
          'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'DENY',
        'Permissions-Policy': 'interest-cohort=()',
      }
    : {}

  // Проверяем админские роуты
  if (pathname.startsWith('/moderator')) {
    // Если пользователь уже на странице логина - пропускаем
    if (pathname === '/moderator/login') {
      // Если авторизован - редирект в админку
      const role = (session?.user as { role?: string } | undefined)?.role
      if (role === 'admin') {
        return NextResponse.redirect(new URL('/moderator', request.url))
      }
      // Если не авторизован - показываем страницу логина
      const resp = NextResponse.next()
      Object.entries(baseHeaders).forEach(([k, v]) => resp.headers.set(k, v))
      return resp
    }

    // Для всех остальных админских страниц - проверяем авторизацию
    const userRole = (session?.user as { role?: string } | undefined)?.role
    if (!session?.user || userRole !== 'admin') {
      return NextResponse.redirect(new URL('/moderator/login', request.url))
    }
  }

  // Разрешаем preflight-запросы и добавляем CORS + security headers для API
  if (isApi && method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: baseHeaders })
  }

  // Защита сервисных/админских API
  const isProtectedApi =
    pathname.startsWith('/api/moderator') ||
    pathname.startsWith('/api/vector-db') ||
    pathname.startsWith('/api/upload') ||
    pathname === '/api/sync' ||
    pathname.startsWith('/api/settings')

  if (isProtectedApi) {
    const userRole = (session?.user as { role?: string } | undefined)?.role
    if (!session?.user || userRole !== 'admin') {
      const resp = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      Object.entries(baseHeaders).forEach(([k, v]) => resp.headers.set(k, v))
      return resp
    }
  }

  const resp = NextResponse.next()
  Object.entries(baseHeaders).forEach(([k, v]) => resp.headers.set(k, v))
  return resp
}

export const config = {
  matcher: ['/moderator/:path*', '/api/:path*'],
}
