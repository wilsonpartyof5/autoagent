import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createScreenshotSaver(dir: string, publicBaseUrl?: string | null) {
  return async (bytes: Buffer, vehiclePageUrl: string): Promise<string> => {
    const host = safeHost(vehiclePageUrl);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const relative = path.join(host, `${stamp}.png`);
    const file = path.join(dir, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
    const base = publicBaseUrl?.trim();
    if (!base) return file;
    return `${base.replace(/\/$/, '')}/${relative.split(path.sep).join('/')}`;
  };
}

function safeHost(vehiclePageUrl: string): string {
  try {
    return new URL(vehiclePageUrl).hostname.replace(/[^a-z0-9.-]/gi, '') || 'unknown-host';
  } catch {
    return 'unknown-host';
  }
}
