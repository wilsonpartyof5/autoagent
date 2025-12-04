import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { generateSessionId } from '@autoagent/shared'

const SESSION_COOKIE_NAME = 'aa_session_id';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Ensure analytics session cookie exists (for session persistence)
  let sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionId) {
    sessionId = generateSessionId();
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS / 1000,
      path: '/',
    });
  }

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

  // Track dashboard login when user accesses /app/** routes
  if (request.nextUrl.pathname.startsWith('/app') && user) {
    // Track login event asynchronously (don't block request)
    (async () => {
      try {
        const { trackEvent } = await import('@/lib/analytics/tracking');
        // Get active dealership to track with
        try {
          const { data } = await supabase
            .from('user_preferences')
            .select('active_dealership_id, dealerships!inner(marketcheck_dealer_id)')
            .eq('user_id', user.id)
            .maybeSingle();
          
          const dealerId = (data?.dealerships as { marketcheck_dealer_id?: string } | null)?.marketcheck_dealer_id;
          
          try {
            await trackEvent('dashboard.login', {}, {
              dealerId,
            });
          } catch {
            // Ignore errors - tracking should not block requests
          }
        } catch {
          // Ignore errors from user_preferences query
        }
      } catch {
        // Ignore module load errors
      }
    })();
  }

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
