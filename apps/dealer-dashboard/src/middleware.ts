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
    const newSessionId = generateSessionId();
    sessionId = newSessionId;
    response.cookies.set(SESSION_COOKIE_NAME, newSessionId, {
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

  const pathname = request.nextUrl.pathname
  const isAuthCallback = pathname.startsWith('/auth/callback')
  const isAuthPage = pathname === '/auth'
  const isAppRoute = pathname.startsWith('/app')
  const isOnboardingRoute = pathname.startsWith('/onboarding')

  // The callback route must receive PKCE and OTP parameters before any auth redirect.
  if (isAuthCallback) {
    return response
  }

  if (!user && (isAppRoute || isOnboardingRoute)) {
    return redirectWithCookies(new URL('/auth', request.url), response)
  }

  let isPlatformAdmin = false
  let onboardingCompleted = false
  let onboardingStep = 1

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('onboarding_completed, onboarding_step, platform_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[middleware] Failed to load onboarding profile:', profileError)
    }

    isPlatformAdmin = profile?.platform_role === 'platform_admin'
    onboardingCompleted = Boolean(profile?.onboarding_completed)
    onboardingStep =
      profile?.onboarding_step === 2 || profile?.onboarding_step === 3
        ? profile.onboarding_step
        : 1
  }

  if (user && !isPlatformAdmin && (isAppRoute || isOnboardingRoute)) {
    // Onboarding integrity check: Detect suspicious prelinked state for new users
    try {
      const { checkOnboardingIntegrity } = await import('@/lib/supabase/integrity-check');
      const integrityResult = await checkOnboardingIntegrity(supabase, user.id);
      
      if (!integrityResult.isValid) {
        // Block onboarding and redirect to auth with error state
        const authUrl = new URL('/auth', request.url);
        authUrl.searchParams.set('error', 'integrity_check_failed');
        authUrl.searchParams.set('message', integrityResult.errorMessage || 'Account setup error');
        
        // Log structured event for ops review
        console.error('[middleware] Integrity check failed, blocking access:', {
          userId: user.id,
          email: user.email,
          path: request.nextUrl.pathname,
          details: integrityResult.details,
        });
        
        // Sign out user to prevent any potential access
        await supabase.auth.signOut();
        
        return redirectWithCookies(authUrl, response);
      }
    } catch (error) {
      // Log but don't block on integrity check errors (fail open for UX)
      console.error('[middleware] Integrity check error:', error);
    }
  }

  if (user && !isPlatformAdmin && isAppRoute && !onboardingCompleted) {
    const onboardingUrl = new URL('/onboarding', request.url)
    onboardingUrl.searchParams.set('step', String(onboardingStep))
    return redirectWithCookies(onboardingUrl, response)
  }

  if (user && !isPlatformAdmin && isOnboardingRoute && onboardingCompleted) {
    return redirectWithCookies(new URL('/app/leads', request.url), response)
  }

  // Track dashboard login when user accesses /app/** routes
  if (isAppRoute && user) {
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

  // All dealer sign-ins resolve through onboarding; middleware then applies completion state.
  if (isAuthPage && user) {
    const destination = isPlatformAdmin ? '/app/leads' : '/onboarding'
    return redirectWithCookies(new URL(destination, request.url), response)
  }

  return response
}

export const config = {
  matcher: ['/app/:path*', '/auth', '/auth/:path*', '/onboarding/:path*'],
}

function redirectWithCookies(url: URL, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
  return redirectResponse
}
