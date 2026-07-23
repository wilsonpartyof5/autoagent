import { createHmac, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import type { Request, Response } from 'express';
import { CONFIG } from '../config/env.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 8_000;

function signature(source: string): string {
  return createHmac('sha256', Buffer.from(CONFIG.leadEncKey, 'base64'))
    .update(source)
    .digest('base64url');
}

function privateIp(hostname: string): boolean {
  if (!isIP(hostname)) return false;
  return (
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function decodeSource(encoded: string): URL {
  const value = Buffer.from(encoded, 'base64url').toString('utf8');
  const url = new URL(value);
  if (url.protocol !== 'https:' || privateIp(url.hostname)) {
    throw new Error('IMAGE_SOURCE_NOT_ALLOWED');
  }
  return url;
}

export function proxiedVehicleImageUrl(sourceUrl: string): string {
  const source = Buffer.from(sourceUrl, 'utf8').toString('base64url');
  const url = new URL('/vehicle-image', CONFIG.widgetHost);
  url.searchParams.set('src', source);
  url.searchParams.set('sig', signature(source));
  return url.toString();
}

export async function handleVehicleImage(req: Request, res: Response) {
  const encoded = typeof req.query.src === 'string' ? req.query.src : '';
  const provided = typeof req.query.sig === 'string' ? req.query.sig : '';
  const expected = signature(encoded);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (
    !encoded ||
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return res.status(403).json({ error: 'Invalid image signature' });
  }

  let target: URL;
  try {
    target = decodeSource(encoded);
  } catch {
    return res.status(400).json({ error: 'Invalid image source' });
  }

  if (target.hostname === 'api.marketcheck.com') {
    target.searchParams.set('api_key', CONFIG.marketcheckApiKey);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      signal: controller.signal,
      redirect: 'error',
      headers: { Accept: 'image/*' },
    });
    if (!upstream.ok) {
      console.warn(
        JSON.stringify({
          event: 'vehicle_image_failed',
          imageHost: target.hostname,
          status: upstream.status,
          errorCode: `IMAGE_HTTP_${upstream.status}`,
        }),
      );
      return res.status(502).json({ error: 'Image unavailable' });
    }
    const contentType = upstream.headers.get('content-type') ?? '';
    const contentLength = Number(upstream.headers.get('content-length') ?? 0);
    if (
      !contentType.toLowerCase().startsWith('image/') ||
      contentLength > MAX_IMAGE_BYTES
    ) {
      return res.status(415).json({ error: 'Invalid image response' });
    }
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: 'Image too large' });
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(bytes);
  } catch (error) {
    const errorCode =
      error instanceof Error && error.name === 'AbortError'
        ? 'IMAGE_TIMEOUT'
        : 'IMAGE_FETCH_FAILED';
    console.warn(
      JSON.stringify({
        event: 'vehicle_image_failed',
        imageHost: target.hostname,
        errorCode,
      }),
    );
    return res.status(502).json({ error: 'Image unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}
