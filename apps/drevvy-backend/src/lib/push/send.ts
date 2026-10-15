import { createSign } from 'node:crypto';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type PushMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type SendPushResult =
  | { delivered: false; reason: 'unconfigured' }
  | { delivered: true; messageId: string }
  | { delivered: false; reason: 'rejected'; status: number };

export type FcmConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type CachedToken = {
  token: string;
  expiresAt: number;
};

export type FcmEnv = {
  FCM_PROJECT_ID?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
};

export type SendPushDeps = {
  env?: FcmEnv;
  fetch?: typeof fetch;
  now?: Date;
  cache?: Map<string, CachedToken>;
};

const tokenCache = new Map<string, CachedToken>();

export function readProcessFcmEnv(env: NodeJS.ProcessEnv): FcmEnv {
  const source = env as NodeJS.ProcessEnv & FcmEnv;
  return {
    FCM_PROJECT_ID: source.FCM_PROJECT_ID,
    FCM_CLIENT_EMAIL: source.FCM_CLIENT_EMAIL,
    FCM_PRIVATE_KEY: source.FCM_PRIVATE_KEY,
  };
}

export function readFcmConfig(env: FcmEnv): FcmConfig | null {
  const projectId = env.FCM_PROJECT_ID?.trim();
  const clientEmail = env.FCM_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(env.FCM_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

/**
 * Sends one alert through FCM HTTP v1, with an APNs alert payload.
 * When FCM_PROJECT_ID, FCM_CLIENT_EMAIL, or FCM_PRIVATE_KEY is unset, this
 * returns without calling Google.
 */
export async function sendPush(message: PushMessage, deps: SendPushDeps = {}): Promise<SendPushResult> {
  const env = deps.env ?? readProcessFcmEnv(process.env);
  const config = readFcmConfig(env);
  if (!config) return { delivered: false, reason: 'unconfigured' };

  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? new Date();
  const cache = deps.cache ?? tokenCache;
  const accessToken = await accessTokenFor(config, fetchImpl, now, cache);
  if (!accessToken) return { delivered: false, reason: 'rejected', status: 401 };

  const response = await fetchImpl(fcmUrl(config.projectId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.data,
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              alert: { title: message.title, body: message.body },
              sound: 'default',
            },
          },
        },
      },
    }),
  });

  if (!response.ok) return { delivered: false, reason: 'rejected', status: response.status };
  const payload = await response.json().catch(() => null) as { name?: string } | null;
  return { delivered: true, messageId: payload?.name ?? '' };
}

export function signFcmJwt(config: FcmConfig, nowSeconds: number): string {
  const header = base64urlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64urlJson({
    iss: config.clientEmail,
    sub: config.clientEmail,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    scope: FCM_SCOPE,
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(config.privateKey).toString('base64url')}`;
}

async function accessTokenFor(
  config: FcmConfig,
  fetchImpl: typeof fetch,
  now: Date,
  cache: Map<string, CachedToken>,
): Promise<string | null> {
  const nowMs = now.getTime();
  const cached = cache.get(config.clientEmail);
  if (cached && cached.expiresAt > nowMs + 60_000) return cached.token;

  const assertion = signFcmJwt(config, Math.floor(nowMs / 1000));
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as { access_token?: string; expires_in?: number } | null;
  if (!payload?.access_token) return null;
  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
  cache.set(config.clientEmail, {
    token: payload.access_token,
    expiresAt: nowMs + expiresIn * 1000,
  });
  return payload.access_token;
}

function fcmUrl(projectId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
}

function normalizePrivateKey(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/^"|"$/g, '');
  if (!trimmed) return null;
  return trimmed.includes('\\n') ? trimmed.replace(/\\n/g, '\n') : trimmed;
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
