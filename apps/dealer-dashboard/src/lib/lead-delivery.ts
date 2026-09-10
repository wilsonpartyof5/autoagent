/**
 * Ask the MCP worker to drain due CRM delivery jobs.
 * Persist already succeeded if this kick fails; cron and MCP startup retry.
 */
export async function kickLeadDeliveryOutbox(): Promise<void> {
  const mcpServerUrl = process.env.MCP_SERVER_URL || process.env.INGESTION_SERVICE_URL;
  const token =
    process.env.INGESTION_API_TOKEN ||
    process.env.MCP_SERVER_TOKEN ||
    process.env.DASHBOARD_INGEST_TOKEN;

  if (!mcpServerUrl || !token) {
    return;
  }

  const url = `${mcpServerUrl.replace(/\/+$/, '')}/api/internal/lead-delivery/process`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Lead delivery kick failed (${response.status}): ${body.slice(0, 200)}`);
  }
}
