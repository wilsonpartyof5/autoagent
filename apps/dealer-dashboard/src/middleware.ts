import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase env vars are missing (e.g., marketing-only environments), skip auth middleware.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase env vars missing in middleware; skipping auth guard.')
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
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect /app/** routes
  if (request.nextUrl.pathname.startsWith('/app')) {
    if (!user) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }
  }

  // Redirect authenticated users away from /auth
  if (request.nextUrl.pathname === '/auth' && user) {
    return NextResponse.redirect(new URL('/app/setup', request.url))
  }

  return response
}

export const config = {
  matcher: ['/app/:path*', '/auth', '/auth/:path*'],
}
