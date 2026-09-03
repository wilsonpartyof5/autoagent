import { trackEvent } from '../lib/analytics/tracking.js';
import { generateRequestId } from '@autoagent/shared';
import { getUVSVehicleById } from '../db/uvs-vehicles.js';
import type { UnifiedVehicle } from '@autoagent/shared';

/**
 * Compare vehicles by IDs or VINs
 * Emits vehicle.compare event with required IDs
 */
export async function compareVehicles(
  params: unknown,
  _context?: { /* No PII context */ }
): Promise<{
  success: boolean;
  data?: {
    content: { type: string; text: string; }[];
    vehicles?: UnifiedVehicle[];
    structuredContent?: unknown;
    components: { type: string; url: string; }[];
  };
  error?: string;
}> {
  void _context;
  try {
    // Validate input parameters
    const input = params as {
      vehicleIds?: string[];
      vins?: string[];
      dealerId?: string;
    };

    if (!input.vehicleIds && !input.vins) {
      return {
        success: false,
        error: 'Either vehicleIds or vins must be provided',
      };
    }

    const vehicleIds = input.vehicleIds || [];
    const vins = input.vins || [];
    const dealerId = input.dealerId;

    if (vehicleIds.length === 0 && vins.length === 0) {
      return {
        success: false,
        error: 'At least one vehicleId or vin must be provided',
      };
    }

    // Generate requestId for correlation
    const requestId = generateRequestId();

    // Fetch vehicles by IDs or VINs
    const vehicles: UnifiedVehicle[] = [];
    
    // Try to fetch by vehicleIds first
    if (vehicleIds.length > 0) {
      for (const vehicleId of vehicleIds) {
        try {
          const vehicle = await getUVSVehicleById(vehicleId);
          if (vehicle) {
            vehicles.push(vehicle);
          }
        } catch (error) {
          console.warn(`Failed to fetch vehicle ${vehicleId}:`, error);
        }
      }
    }

    // If we have VINs but no vehicles found, try fetching by VIN
    if (vehicles.length === 0 && vins.length > 0) {
      // Note: This would require a VIN lookup function - for now, we'll track with what we have
      console.warn('VIN-based lookup not yet implemented, using provided VINs for tracking');
    }

    // Extract VINs from fetched vehicles or use provided VINs
    const resolvedVins = vehicles.length > 0
      ? vehicles.map(v => v.baseIdentity?.vin).filter((v): v is string => !!v)
      : vins;

    // Track compare event
    const firstVehicleId = vehicleIds[0] || vehicles[0]?.id;
    const firstVin = resolvedVins[0];
    
    // Extract dealerId from UVS structure: location.dealer.dealerId
    const resolvedDealerId = dealerId || vehicles[0]?.location?.dealer?.dealerId;

    await trackEvent('vehicle.compare', {
      vehicleIds: vehicleIds.length > 0 ? vehicleIds : vehicles.map(v => v.id).filter((id): id is string => !!id),
      vins: resolvedVins.length > 0 ? resolvedVins : undefined,
      compareCount: vehicles.length || vehicleIds.length || vins.length,
    }, {
      dealerId: resolvedDealerId,
      vehicleId: firstVehicleId, // Use first vehicleId for DB FK constraint
      vin: firstVin,
      requestId,
      sessionId: requestId, // Use requestId as sessionId for request-level correlation
    }).catch((error) => {
      console.error('Failed to track compare event:', error);
      // Don't fail the request if tracking fails
    });

    return {
      success: true,
      data: {
        content: [{ 
          type: 'text', 
          text: `Comparing ${vehicles.length || vehicleIds.length || vins.length} vehicle(s)` 
        }],
        vehicles: vehicles.length > 0 ? vehicles : undefined,
        structuredContent: {
          comparison: {
            vehicleIds,
            vins: resolvedVins,
            count: vehicles.length || vehicleIds.length || vins.length,
          }
        },
        components: [], // Could add a comparison UI component here
      },
    };
  } catch (error) {
    console.error('Error comparing vehicles:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error comparing vehicles',
    };
  }
}

