import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const deliverLead = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: fromMock }),
}));

vi.mock('../src/services/deliverLead.js', () => ({
  deliverLead: (...args: unknown[]) => deliverLead(...args),
}));

function thenable(result: { data?: unknown; error?: { message: string } | null }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.lte = vi.fn(self);
  builder.lt = vi.fn(self);
  builder.order = vi.fn(self);
  builder.limit = vi.fn(self);
  builder.update = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe('leadDeliveryOutbox', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    deliverLead.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  });

  it('caps retry delay at 30 minutes', async () => {
    const { nextBackoffMs } = await import('../src/services/leadDeliveryOutbox.js');
    expect(nextBackoffMs(1)).toBe(2000);
    expect(nextBackoffMs(8)).toBe(256000);
    expect(nextBackoffMs(20)).toBe(30 * 60 * 1000);
  });

  it('marks email-unimplemented deliveries as a terminal failure', async () => {
    const job = {
      id: 'job-1',
      lead_id: 'lead-1',
      dealership_id: 'dealer-uuid',
      dealer_id: 'mc-1',
      attempts: 0,
      max_attempts: 8,
    };
    const updates: Array<Record<string, unknown>> = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'lead_delivery_jobs') {
        const pending = thenable({ data: [job], error: null });
        pending.update = vi.fn((payload: Record<string, unknown>) => {
          updates.push(payload);
          return thenable({ data: payload.status === 'processing' ? { id: job.id } : null, error: null });
        });
        return pending;
      }
      return thenable({
        data: {
          id: 'lead-1',
          dealer_id: 'mc-1',
          dealership_id: 'dealer-uuid',
          vehicle_id: 'veh-1',
          vin: '1HGBH41JXMN109186',
          enc_payload: 'enc',
        },
        error: null,
      });
    });

    deliverLead.mockResolvedValue({
      success: false,
      error: 'Email delivery not yet implemented',
    });

    const { processLeadDeliveryJobs } = await import('../src/services/leadDeliveryOutbox.js');
    const result = await processLeadDeliveryJobs();

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(updates.at(-1)?.status).toBe('failed');
    expect(updates.at(-1)?.last_error).toMatch(/not yet implemented/i);
  });

  it('skips a job another worker already claimed', async () => {
    const job = {
      id: 'job-2',
      lead_id: 'lead-2',
      dealership_id: null,
      dealer_id: 'mc-1',
      attempts: 0,
      max_attempts: 8,
    };

    fromMock.mockImplementation((table: string) => {
      if (table === 'lead_delivery_jobs') {
        const pending = thenable({ data: [job], error: null });
        pending.update = vi.fn((payload: Record<string, unknown>) =>
          thenable({
            data: payload.status === 'processing' ? null : null,
            error: null,
          }),
        );
        return pending;
      }
      return thenable({ data: null, error: null });
    });

    const { processLeadDeliveryJobs } = await import('../src/services/leadDeliveryOutbox.js');
    const result = await processLeadDeliveryJobs();

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    expect(deliverLead).not.toHaveBeenCalled();
  });
});
