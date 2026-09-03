export type FetchAndIngestInput = {
  dealerId: string;
  source?: string;
};

export type FetchAndIngestResult = {
  success: true;
  fetched: number;
  imported: number;
  valid: number;
  invalid: number;
  summary: { stored: number; valid: number; invalid: number };
};

/**
 * Call the MCP syndication ingest endpoint.
 * Kept out of `'use server'` modules so cron/routes can import it safely.
 */
export async function fetchAndIngestMarketCheckInventory({
  dealerId,
  source,
}: FetchAndIngestInput): Promise<FetchAndIngestResult> {
  if (!dealerId && !source) {
    throw new Error('dealerId or source is required');
  }

  const mcpServerUrl = process.env.MCP_SERVER_URL || process.env.INGESTION_SERVICE_URL;
  if (!mcpServerUrl) {
    throw new Error('MCP_SERVER_URL or INGESTION_SERVICE_URL must be configured');
  }

  const ingestionToken = process.env.INGESTION_API_TOKEN || process.env.MCP_SERVER_TOKEN;
  if (!ingestionToken) {
    throw new Error('INGESTION_API_TOKEN must be configured');
  }

  const url = `${mcpServerUrl.replace(/\/+$/, '')}/api/ingest/marketcheck/fetch-and-ingest`;

  try {
    console.log('[fetchAndIngestMarketCheckInventory] Calling MCP syndication ingest:', {
      url,
      dealerId,
      source,
      endpoint: '/v2/dealerships/inventory',
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ingestionToken}`,
      },
      body: JSON.stringify({
        dealerId,
        source,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `MCP fetch-and-ingest failed (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
        if (errorJson.details) {
          errorMessage += `: ${errorJson.details}`;
        }
      } catch {
        errorMessage += `: ${errorText.substring(0, 500)}`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Fetch and ingest failed');
    }

    const summary = result.ingestion?.summary || {};
    const fetched = result.fetched || 0;
    const stored = summary.stored || 0;
    const valid = summary.valid || 0;
    const invalid = summary.invalid || 0;

    return {
      success: true,
      fetched,
      imported: stored,
      valid,
      invalid,
      summary: { stored, valid, invalid },
    };
  } catch (error) {
    console.error('[fetchAndIngestMarketCheckInventory] Error:', {
      dealerId,
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
