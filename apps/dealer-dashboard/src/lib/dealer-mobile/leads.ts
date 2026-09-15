import { decryptToJson, isDecryptedLead } from '@/lib/crypto';
import {
  DealerMobileApiError,
  type DealerMobileAuth,
} from '@/lib/dealer-mobile/auth';
import type { AuthorizedDealership } from '@/lib/dealer-mobile/dealerships';

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'test_drive_booked',
  'closed',
] as const;

export type MobileLeadStatus = (typeof LEAD_STATUSES)[number];

export type MobileLead = {
  id: string;
  createdAt: string;
  status: MobileLeadStatus;
  source: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
    preferredTime?: string;
  };
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    vin?: string;
  };
  delivery: {
    method: string;
    state: 'pending' | 'delivered' | 'failed';
    attemptedAt?: string;
    message?: string;
  };
};

type LeadScope = {
  dealership_id?: string | null;
  dealer_id?: string | null;
};

export function leadBelongsToDealership(
  lead: LeadScope,
  dealership: AuthorizedDealership,
): boolean {
  if (lead.dealership_id) return lead.dealership_id === dealership.id;
  return Boolean(
    dealership.marketcheckDealerId &&
      lead.dealer_id === dealership.marketcheckDealerId,
  );
}

export function clampPageSize(value: string | null, fallback = 100): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 100);
}

export async function listMobileLeads(
  auth: DealerMobileAuth,
  dealership: AuthorizedDealership,
  options: { limit?: number; offset?: number } = {},
): Promise<MobileLead[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = auth.supabase
    .from('leads')
    .select(`
      id,
      dealer_id,
      dealership_id,
      vehicle_id,
      vin,
      enc_payload,
      created_at,
      status,
      source,
      vehicle_snapshot,
      uvs_vehicles(
        id,
        vin,
        year,
        make,
        model,
        trim,
        uvs_data
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  query = dealership.marketcheckDealerId
    ? query.or(
        `dealership_id.eq.${dealership.id},and(dealership_id.is.null,dealer_id.eq.${dealership.marketcheckDealerId})`,
      )
    : query.eq('dealership_id', dealership.id);

  const { data, error } = await query;
  if (error) {
    console.error('[dealer-mobile] Failed to load leads:', error);
    throw new DealerMobileApiError('Leads could not be loaded.', 500, 'leads_unavailable');
  }

  const rows = data ?? [];
  const leadIDs = rows.map((lead: any) => lead.id);
  const deliveryByLead = new Map<string, any>();

  if (leadIDs.length > 0) {
    const { data: deliveryLogs, error: deliveryError } = await auth.supabase
      .from('lead_delivery_logs')
      .select('lead_id, status, delivery_method, attempted_at, error_message')
      .in('lead_id', leadIDs)
      .order('attempted_at', { ascending: false });

    if (deliveryError) {
      console.error('[dealer-mobile] Failed to load delivery logs:', deliveryError);
    } else {
      for (const log of deliveryLogs ?? []) {
        if (!deliveryByLead.has(log.lead_id)) {
          deliveryByLead.set(log.lead_id, log);
        }
      }
    }
  }

  return Promise.all(
    rows.map((lead: any) => mapMobileLead(lead, deliveryByLead.get(lead.id))),
  );
}

export async function findAuthorizedLead(
  auth: DealerMobileAuth,
  leadID: string,
  dealerships: AuthorizedDealership[],
): Promise<{ lead: LeadScope & { id: string }; dealership: AuthorizedDealership }> {
  const { data: lead, error } = await auth.supabase
    .from('leads')
    .select('id, dealer_id, dealership_id')
    .eq('id', leadID)
    .maybeSingle();

  if (error || !lead) {
    throw new DealerMobileApiError(
      'This lead is not available to your account.',
      404,
      'lead_not_found',
    );
  }

  const dealership = dealerships.find((candidate) =>
    leadBelongsToDealership(lead, candidate),
  );
  if (!dealership) {
    throw new DealerMobileApiError(
      'This lead is not available to your account.',
      404,
      'lead_not_found',
    );
  }

  return { lead, dealership };
}

async function mapMobileLead(lead: any, deliveryLog: any): Promise<MobileLead> {
  const joinedVehicle = Array.isArray(lead.uvs_vehicles)
    ? lead.uvs_vehicles[0]
    : lead.uvs_vehicles;
  const snapshot = objectValue(lead.vehicle_snapshot);
  const uvsData = objectValue(joinedVehicle?.uvs_data);
  const baseIdentity = objectValue(uvsData.baseIdentity);

  let customer: MobileLead['customer'] = {
    name: 'Lead information unavailable',
    email: '',
  };
  try {
    const decrypted = await decryptToJson(lead.enc_payload);
    if (isDecryptedLead(decrypted)) {
      customer = {
        name: decrypted.user.name,
        email: decrypted.user.email,
        ...(decrypted.user.phone ? { phone: decrypted.user.phone } : {}),
        ...(decrypted.user.preferredTime
          ? { preferredTime: decrypted.user.preferredTime }
          : {}),
      };
    }
  } catch (error) {
    console.error(`[dealer-mobile] Failed to decrypt lead ${lead.id}:`, error);
  }

  const year = numberValue(joinedVehicle?.year, snapshot.year, baseIdentity.year) ?? 0;
  const make = stringValue(joinedVehicle?.make, snapshot.make, baseIdentity.make) ?? 'Unknown';
  const model = stringValue(joinedVehicle?.model, snapshot.model, baseIdentity.model) ?? 'vehicle';
  const trim = stringValue(joinedVehicle?.trim, snapshot.trim, baseIdentity.trim);
  const vin = stringValue(joinedVehicle?.vin, lead.vin, snapshot.vin, baseIdentity.vin);

  return {
    id: lead.id,
    createdAt: lead.created_at,
    status: LEAD_STATUSES.includes(lead.status) ? lead.status : 'new',
    source: lead.source || 'Drevvy',
    customer,
    vehicle: {
      year,
      make,
      model,
      ...(trim ? { trim } : {}),
      ...(vin ? { vin } : {}),
    },
    delivery: mapDelivery(deliveryLog),
  };
}

export function mapDelivery(log: any): MobileLead['delivery'] {
  if (!log) {
    return {
      method: 'CRM · ADF/XML',
      state: 'pending',
      message: 'Waiting for delivery',
    };
  }

  return {
    method: log.delivery_method === 'email' ? 'Email · ADF/XML' : 'CRM · ADF/XML',
    state:
      log.status === 'success'
        ? 'delivered'
        : log.status === 'failed'
          ? 'failed'
          : 'pending',
    ...(log.attempted_at ? { attemptedAt: log.attempted_at } : {}),
    ...(log.error_message ? { message: log.error_message } : {}),
  };
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function stringValue(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}

function numberValue(...values: unknown[]): number | undefined {
  const value = values.find(
    (candidate) => typeof candidate === 'number' && Number.isFinite(candidate),
  );
  return typeof value === 'number' ? value : undefined;
}
