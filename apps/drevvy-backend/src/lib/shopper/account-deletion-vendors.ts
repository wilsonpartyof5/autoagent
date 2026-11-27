/**
 * Server-side person deletion after auth.admin.deleteUser succeeds.
 *
 * RevenueCat: REVENUECAT_SECRET_API_KEY is already a backend secret. When it
 * is set, DELETE /v1/subscribers/<user id> runs here. The key is never logged.
 *
 * PostHog: the app only has a client project key (phc_) and an ingest host.
 * Those cannot delete a person. There is no personal API key on the server.
 * Until one is configured outside this repo, the call is skipped and
 * docs/drevvy/ACCOUNT_DELETION_RUNBOOK.md is the manual step.
 */

export type VendorDeletionResult = {
  revenuecat: 'deleted' | 'unconfigured' | 'failed';
  posthog: 'deleted' | 'manual' | 'failed';
};

const REVENUECAT_API = 'https://api.revenuecat.com';
const POSTHOG_APP_API = 'https://us.posthog.com';

export async function deleteExternalShopperRecords(input: {
  userId: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<VendorDeletionResult> {
  const env = input.env ?? process.env;
  const fetchImpl = input.fetchImpl ?? fetch;
  const [revenuecat, posthog] = await Promise.all([
    deleteRevenueCatSubscriber(input.userId, env, fetchImpl),
    deletePostHogPerson(input.userId, env, fetchImpl),
  ]);
  return { revenuecat, posthog };
}

async function deleteRevenueCatSubscriber(
  userId: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<VendorDeletionResult['revenuecat']> {
  const apiKey = env.REVENUECAT_SECRET_API_KEY?.trim();
  if (!apiKey) return 'unconfigured';
  try {
    const response = await fetchImpl(
      `${REVENUECAT_API}/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
    );
    if (response.ok || response.status === 404) return 'deleted';
    console.error(JSON.stringify({
      event: 'account_deletion_revenuecat_failed',
      status: response.status,
    }));
    return 'failed';
  } catch {
    console.error(JSON.stringify({ event: 'account_deletion_revenuecat_failed' }));
    return 'failed';
  }
}

async function deletePostHogPerson(
  userId: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<VendorDeletionResult['posthog']> {
  const apiKey = env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = env.POSTHOG_PROJECT_ID?.trim();
  if (!apiKey || !projectId) {
    console.error(JSON.stringify({
      event: 'account_deletion_posthog_manual',
      userId,
    }));
    return 'manual';
  }
  const host = (env.POSTHOG_APP_HOST?.trim() || POSTHOG_APP_API).replace(/\/$/, '');
  try {
    const response = await fetchImpl(
      `${host}/api/projects/${encodeURIComponent(projectId)}/persons/bulk_delete/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ distinct_ids: [userId] }),
      },
    );
    if (response.ok) return 'deleted';
    console.error(JSON.stringify({
      event: 'account_deletion_posthog_failed',
      status: response.status,
    }));
    return 'failed';
  } catch {
    console.error(JSON.stringify({ event: 'account_deletion_posthog_failed' }));
    return 'failed';
  }
}
