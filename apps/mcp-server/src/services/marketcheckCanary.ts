import { randomUUID } from 'crypto';
import { CONFIG } from '../config/env.js';
import {
  callMarketcheckMcpTool,
  inspectMarketcheckMcpContract,
} from './marketcheckMcpClient.js';
import { normalizeMarketcheckSearchResult } from './marketcheckMcpNormalizer.js';
import { recordFlowEvent } from '../lib/flowTelemetry.js';

async function runCanary() {
  if (CONFIG.inventorySearchProvider !== 'marketcheck_mcp') return;
  const flowId = `canary_${randomUUID()}`;
  const contract = await inspectMarketcheckMcpContract(flowId);
  const search = contract.success
    ? await callMarketcheckMcpTool(
        'search_active_cars',
        {
          zip: '10001',
          radius: 10,
          rows: 1,
          include_dealer_object: true,
          include_build_object: true,
        },
        flowId,
      )
    : contract;
  const normalized = search.success
    ? normalizeMarketcheckSearchResult(search.result)
    : null;
  const healthy = Boolean(
    contract.success &&
      search.success &&
      normalized &&
      normalized.vehicles.length === 1,
  );

  console.log(
    JSON.stringify({
      event: 'marketcheck_canary',
      flowId,
      status: healthy ? 'success' : 'failed',
      errorCode: search.success ? undefined : search.errorCode,
      resultCount: normalized?.vehicles.length ?? 0,
      durationMs: search.latencyMs,
    }),
  );
  await recordFlowEvent({
    flowId,
    eventName: 'provider.canary',
    source: 'system',
    provider: 'marketcheck_mcp',
    toolName: 'search_active_cars',
    status: healthy ? 'success' : 'failed',
    errorCode: search.success ? undefined : search.errorCode,
    durationMs: search.latencyMs,
    resultCount: normalized?.vehicles.length ?? 0,
  });
}

export function startMarketcheckCanary() {
  const initial = setTimeout(() => runCanary().catch(() => {}), 10_000);
  initial.unref();
  const interval = setInterval(
    () => runCanary().catch(() => {}),
    6 * 60 * 60 * 1000,
  );
  interval.unref();
}
