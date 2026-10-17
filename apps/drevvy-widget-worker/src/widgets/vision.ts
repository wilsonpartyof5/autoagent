import type { ChatClient } from '../ai/types';

export type LauncherPoint = {
  x: number;
  y: number;
  reason: string;
};

const VISION_SYSTEM = `You locate a dealer website chat launcher in a screenshot.
Return JSON only:
{"found": boolean, "x": number, "y": number, "reason": string}
x and y are CSS pixels from the top-left of the image.
Set found to true only for a chat bubble or a control whose job is to open chat, text us, or message us.
Set found to false for cookie banners, trade-in popups, captchas, lead forms, and phone or email fields.`;

export function parseLauncherPoint(raw: string): LauncherPoint | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  if (record.found !== true) return null;
  const x = typeof record.x === 'number' ? record.x : Number(record.x);
  const y = typeof record.y === 'number' ? record.y : Number(record.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x > 4000 || y > 4000) return null;
  const reason = typeof record.reason === 'string' ? record.reason : '';
  if (/captcha|cookie|trade-?in|lead form|phone|email/i.test(reason)) return null;
  return { x, y, reason };
}

export async function locateLauncher(ai: ChatClient, image: Buffer): Promise<LauncherPoint | null> {
  try {
    const raw = await ai.complete({
      messages: [
        { role: 'system', content: VISION_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Where is the chat launcher? Return the JSON point, or found false.' },
            { type: 'image', imageBase64: image.toString('base64'), mediaType: 'image/png' },
          ],
        },
      ],
    });
    return parseLauncherPoint(raw);
  } catch {
    return null;
  }
}
