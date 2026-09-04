import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { isIP } from 'net';
import type { Request, Response } from 'express';
import { CONFIG } from '../config/env.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_IMAGE_BYTES = 256 * 1024;
const IMAGE_TIMEOUT_MS = 8_000;
const INLINE_IMAGE_TIMEOUT_MS = 2_500;
const MAX_IMAGE_REDIRECTS = 3;

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

function authenticatedImageTarget(sourceUrl: string): URL {
  const target = new URL(sourceUrl);
  if (target.hostname === 'api.marketcheck.com') {
    target.searchParams.set('api_key', CONFIG.marketcheckApiKey);
  }
  return target;
}

async function fetchVehicleImageBytes(
  sourceUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ bytes: Buffer; contentType: string } | null> {
  let target: URL;
  try {
    target = authenticatedImageTarget(sourceUrl);
    if (target.protocol !== 'https:' || privateIp(target.hostname)) {
      return null;
    }
  } catch {
    return null;
  }

  const timeoutMs = options.timeoutMs ?? IMAGE_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let upstream: globalThis.Response | null = null;
    for (let redirects = 0; redirects <= MAX_IMAGE_REDIRECTS; redirects += 1) {
      upstream = await fetch(target, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { Accept: 'image/*' },
      });
      if (upstream.status < 300 || upstream.status >= 400) break;
      const location = upstream.headers.get('location');
      if (!location || redirects === MAX_IMAGE_REDIRECTS) return null;
      const redirected = new URL(location, target);
      if (redirected.protocol !== 'https:' || privateIp(redirected.hostname)) {
        return null;
      }
      target = authenticatedImageTarget(redirected.toString());
    }
    if (!upstream) return null;
    if (!upstream.ok) return null;

    let contentType = upstream.headers.get('content-type') ?? '';
    const contentLength = Number(upstream.headers.get('content-length') ?? 0);
    if (contentLength > maxBytes) return null;

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > maxBytes) return null;
    const type = contentType.toLowerCase();
    if (!type.startsWith('image/')) {
      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        contentType = 'image/jpeg';
      } else if (
        bytes.length >= 8 &&
        bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ) {
        contentType = 'image/png';
      } else if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) {
        contentType = 'image/gif';
      } else if (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
        bytes.subarray(8, 12).toString('ascii') === 'WEBP'
      ) {
        contentType = 'image/webp';
      } else {
        return null;
      }
    }
    return { bytes, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchVehicleImageDataUrl(sourceUrl: string): Promise<string | null> {
  const fetched = await fetchVehicleImageBytes(sourceUrl, {
    timeoutMs: INLINE_IMAGE_TIMEOUT_MS,
    maxBytes: MAX_INLINE_IMAGE_BYTES,
  });
  if (!fetched) return null;
  return `data:${fetched.contentType};base64,${fetched.bytes.toString('base64')}`;
}

export function decodeProxiedVehicleImageSource(proxiedUrl: string): string | null {
  try {
    const url = new URL(proxiedUrl);
    const encoded = url.searchParams.get('src');
    if (!encoded) return null;
    return Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export async function handleVehicleImage(req: Request, res: Response) {
  const imageRequestId = randomUUID();
  const startedAt = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Vary', 'Origin');
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
    console.warn(JSON.stringify({
      event: 'vehicle_image_rejected',
      imageRequestId,
      status: 403,
      errorCode: 'IMAGE_SIGNATURE_INVALID',
    }));
    return res.status(403).json({ error: 'Invalid image signature' });
  }

  let target: URL;
  try {
    target = decodeSource(encoded);
  } catch {
    console.warn(JSON.stringify({
      event: 'vehicle_image_rejected',
      imageRequestId,
      status: 400,
      errorCode: 'IMAGE_SOURCE_INVALID',
    }));
    return res.status(400).json({ error: 'Invalid image source' });
  }

  target = authenticatedImageTarget(target.toString());

  try {
    const fetched = await fetchVehicleImageBytes(target.toString(), {
      timeoutMs: IMAGE_TIMEOUT_MS,
      maxBytes: MAX_IMAGE_BYTES,
    });
    if (!fetched) {
      console.warn(JSON.stringify({
        event: 'vehicle_image_failed',
        imageRequestId,
        imageHost: target.hostname,
        status: 502,
        errorCode: 'IMAGE_FETCH_FAILED',
      }));
      return res.status(502).json({ error: 'Image unavailable' });
    }
    const { bytes, contentType } = fetched;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    console.log(JSON.stringify({
      event: 'vehicle_image_success',
      imageRequestId,
      imageHost: target.hostname,
      status: 200,
      bytes: bytes.length,
      durationMs: Date.now() - startedAt,
    }));
    return res.status(200).send(bytes);
  } catch (error) {
    const errorCode =
      error instanceof Error && error.name === 'AbortError'
        ? 'IMAGE_TIMEOUT'
        : 'IMAGE_FETCH_FAILED';
    console.warn(
      JSON.stringify({
        event: 'vehicle_image_failed',
        imageRequestId,
        imageHost: target.hostname,
        errorCode,
      }),
    );
    return res.status(502).json({ error: 'Image unavailable' });
  }
}
