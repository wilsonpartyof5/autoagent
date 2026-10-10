import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { adminPreviewEnabled, isAllowlistedAdmin, safeAdminNextPath } from '@/lib/admin/access'

const SESSION_COOKIE_NAME = 'aa_session_id'
const SESSION_DURATION_MS = 30 * 60 * 1000

function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `sess_${timestamp}_${random}`
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  let sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!sessionId) {
    sessionId = generateSessionId()
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS / 1000,
      path: '/',
    })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const pathname = request.nextUrl.pathname
  const adminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (adminPath && adminPreviewEnabled()) {
    return response
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    if (adminPath) return new NextResponse(null, { status: 404 })
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
          response.cookies.set(SESSION_COOKIE_NAME, sessionId!, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_DURATION_MS / 1000,
            path: '/',
          })
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (adminPath) {
    if (!user || !isAllowlistedAdmin(user.email)) {
      if (!user && pathname.startsWith('/admin')) {
        const authUrl = new URL('/auth', request.url)
        authUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(authUrl)
      }
      return new NextResponse(null, { status: 404 })
    }
  }

  if (pathname === '/auth' && user) {
    const nextPath = safeAdminNextPath(request.nextUrl.searchParams.get('next'))
    return NextResponse.redirect(new URL(nextPath ?? '/admin', request.url))
  }

  return response
}

export const config = {
  matcher: ['/auth', '/auth/:path*', '/admin', '/admin/:path*', '/api/admin/:path*'],
}
