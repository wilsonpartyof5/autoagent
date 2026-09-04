import { beforeEach, describe, expect, it, vi } from 'vitest';

const callMarketcheckMcpTool = vi.fn();

vi.mock('../src/services/marketcheckMcpClient.js', () => ({
  callMarketcheckMcpTool,
}));

vi.mock('../src/lib/flowTelemetry.js', () => ({
  recordFlowEvent: vi.fn(() => Promise.resolve()),
}));

describe('getVehicleDetails', () => {
  beforeEach(async () => {
    callMarketcheckMcpTool.mockReset();
    const { clearVehicleDetailCache } = await import('../src/lib/vehicleDetailCache.js');
    clearVehicleDetailCache();
  });

  it('includes duplicate active listings when looking up a result by VIN', async () => {
    callMarketcheckMcpTool.mockResolvedValue({
      success: true,
      result: {
        structuredContent: {
          success: true,
          data: {
            num_found: 1,
            listings: [{
              id: 'listing-1',
              vin: '1FTFW1RG8SFB77510',
              price: 48000,
              inventory_type: 'used',
              build: { year: 2025, make: 'Ford', model: 'F-150' },
              dealer: { id: 'dealer-1', name: 'Example Ford' },
            }],
          },
        },
      },
      latencyMs: 20,
    });

    const { getVehicleDetails } = await import('../src/tools/getVehicleDetails.js');
    const result = await getVehicleDetails({ vin: '1FTFW1RG8SFB77510' });

    expect(callMarketcheckMcpTool).toHaveBeenCalledWith(
      'search_active_cars',
      expect.objectContaining({
        vin: '1FTFW1RG8SFB77510',
        nodedup: true,
        rows: 1,
      }),
      expect.any(String),
    );
    expect(result).toMatchObject({
      success: true,
      structuredContent: {
        vehicle: {
          baseIdentity: { vin: '1FTFW1RG8SFB77510' },
        },
      },
    });
  });

  it('falls back to the signed search snapshot when MarketCheck no longer resolves the VIN', async () => {
    const { rememberVehicleDetails } = await import('../src/lib/vehicleDetailCache.js');
    rememberVehicleDetails([{
      id: 'listing-from-search',
      title: '2022 Ford F-150 Lariat',
      baseIdentity: {
        vin: '1FTFW1E57NFA68092',
        year: 2022,
        make: 'Ford',
        model: 'F-150',
        trim: 'Lariat',
      },
      pricing: { price: 47000, currency: 'USD' },
      location: { dealer: { name: 'Example Ford' } },
    }]);
    callMarketcheckMcpTool.mockResolvedValue({
      success: true,
      result: { structuredContent: { success: true, data: { num_found: 0, listings: [] } } },
      latencyMs: 25,
    });

    const { getVehicleDetails } = await import('../src/tools/getVehicleDetails.js');
    const result = await getVehicleDetails({
      vin: '1FTFW1E57NFA68092',
      listingId: 'listing-from-search',
    });

    expect(result).toMatchObject({
      success: true,
      structuredContent: {
        vehicle: {
          id: 'listing-from-search',
          pricing: { price: 47000 },
        },
      },
    });
  });
});
