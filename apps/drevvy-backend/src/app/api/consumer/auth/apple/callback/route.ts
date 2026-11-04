import { NextRequest, NextResponse } from 'next/server';

import { appleAndroidIntentLocation } from '@/lib/consumer/apple-android-callback';

/**
 * GET/POST /api/consumer/auth/apple/callback
 *
 * Return URL for the Apple Services ID used by Android Sign in with Apple.
 * Apple posts the form here. We send the browser back into the shopper app.
 * This route does not create a session and does not grant keys.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const entries: [string, string][] = [];
  request.nextUrl.searchParams.forEach((value, key) => {
    entries.push([key, value]);
  });
  return redirectToApp(appleAndroidIntentLocation(entries));
}

export async function POST(request: NextRequest) {
  const entries: [string, string][] = [];
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') entries.push([key, value]);
      }
    }
  } else {
    const form = await request.formData().catch(() => null);
    if (form) {
      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') entries.push([key, value]);
      }
    }
  }
  return redirectToApp(appleAndroidIntentLocation(entries));
}

function redirectToApp(location: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
    },
  });
}
