import { z } from 'zod';
import { randomUUID } from 'crypto';
import { callMarketcheckMcpTool } from '../services/marketcheckMcpClient.js';
import { normalizeMarketcheckSearchResult } from '../services/marketcheckMcpNormalizer.js';
import { recordFlowEvent } from '../lib/flowTelemetry.js';
import { findVehicleDetails } from '../lib/vehicleDetailCache.js';

const InputSchema = z
  .object({
    listingId: z.string().min(1).optional(),
    vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{11,17}$/i).optional(),
    flowId: z.string().optional(),
  })
  .refine((value) => value.vin, {
    message: 'vin is required for a current detail lookup',
  });

function detailResult(
  vehicle: Record<string, unknown>,
  flowId: string,
  source: 'marketcheck_mcp' | 'search_result_cache',
  durationMs: number,
) {
  const identity =
    (vehicle.baseIdentity as Record<string, unknown> | undefined) ?? {};
  const vehicleId = typeof vehicle.id === 'string' ? vehicle.id : undefined;
  const vin = typeof identity.vin === 'string' ? identity.vin : undefined;
  console.log(JSON.stringify({
    event: 'vehicle_detail_succeeded',
    flowId,
    provider: source,
    listingId: vehicleId,
    durationMs,
  }));
  recordFlowEvent({
    flowId,
    eventName: 'vehicle.detail_succeeded',
    source: 'mcp-server',
    provider: source,
    toolName: source === 'marketcheck_mcp' ? 'search_active_cars' : 'search_result_cache',
    vehicleId,
    vin,
    status: 'success',
    durationMs,
    payload: { fallback: source === 'search_result_cache' },
  }).catch(() => {});
  return {
    success: true,
    content: [{
      type: 'text',
      text: `Loaded details for ${identity.year ?? ''} ${identity.make ?? ''} ${identity.model ?? ''}.`.replace(/\s+/g, ' ').trim(),
    }],
    structuredContent: { vehicle, flowId },
    _meta: { vehicle, flowId },
  };
}

export async function getVehicleDetails(params: unknown) {
  const parsed = InputSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }
  const flowId = parsed.data.flowId ?? randomUUID();
  const call = await callMarketcheckMcpTool(
    'search_active_cars',
    {
      ...(parsed.data.vin ? { vin: parsed.data.vin } : {}),
      // Search results can contain a valid duplicate/non-attributed listing.
      // nodedup ensures a VIN lookup still returns those active records.
      nodedup: true,
      rows: 1,
      fetch_all_photos: true,
      include_dealer_object: true,
      include_mc_dealership_object: true,
      include_build_object: true,
      include_finance: true,
      include_lease: true,
      include_relevant_links: true,
    },
    flowId,
  );
  if (!call.success) {
    const cached = findVehicleDetails(parsed.data);
    if (cached) return detailResult(cached, flowId, 'search_result_cache', call.latencyMs);
    console.error(
      JSON.stringify({
        event: 'vehicle_detail_failed',
        flowId,
        provider: 'marketcheck_mcp',
        errorCode: call.errorCode,
        durationMs: call.latencyMs,
      }),
    );
    recordFlowEvent({
      flowId,
      eventName: 'vehicle.detail_failed',
      source: 'mcp-server',
      provider: 'marketcheck_mcp',
      toolName: 'search_active_cars',
      status: 'failed',
      errorCode: call.errorCode,
      durationMs: call.latencyMs,
    }).catch(() => {});
    return { success: false, error: call.error };
  }

  const normalized = normalizeMarketcheckSearchResult(call.result);
  const vehicle =
    normalized.vehicles.find((candidate) => candidate.id === parsed.data.listingId) ??
    normalized.vehicles[0];
  if (!vehicle) {
    const cached = findVehicleDetails(parsed.data);
    if (cached) return detailResult(cached, flowId, 'search_result_cache', call.latencyMs);
    return { success: false, error: 'Vehicle detail is no longer available.' };
  }

  return detailResult(vehicle as unknown as Record<string, unknown>, flowId, 'marketcheck_mcp', call.latencyMs);
}
