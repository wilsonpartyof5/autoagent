/**
 * Vendor status feed polling for Telnyx and ElevenLabs.
 * Polls status.telnyx.com and status.elevenlabs.io for incident data.
 */

export type StatusPageSummary = {
  page: {
    id: string;
    name: string;
    url: string;
    updated_at: string;
  };
  status: {
    indicator: 'none' | 'minor' | 'major' | 'critical';
    description: string;
  };
  components: Array<{
    id: string;
    name: string;
    status: string;
    description?: string;
  }>;
  incidents: Array<{
    id: string;
    name: string;
    status: string;
    impact: string;
    shortlink?: string;
    created_at: string;
    updated_at: string;
    resolved_at?: string;
    incident_updates: Array<{
      id: string;
      body: string;
      status: string;
      created_at: string;
    }>;
  }>;
  scheduled_maintenances: Array<{
    id: string;
    name: string;
    status: string;
    scheduled_for: string;
    scheduled_until: string;
  }>;
};

export type VendorStatusResult = {
  vendor: 'telnyx' | 'elevenlabs';
  success: boolean;
  statusIndicator: string | null;
  incidents: Array<{
    externalId: string;
    title: string;
    status: string;
    impact: string;
    url: string | null;
    startedAt: string | null;
    resolvedAt: string | null;
    components: string[];
    raw: unknown;
  }>;
  error?: string;
};

const STATUS_URLS = {
  telnyx: 'https://status.telnyx.com/api/v2/summary.json',
  elevenlabs: 'https://status.elevenlabs.io/api/v2/summary.json',
} as const;

export async function fetchVendorStatus(
  vendor: 'telnyx' | 'elevenlabs',
): Promise<VendorStatusResult> {
  const url = STATUS_URLS[vendor];

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return {
        vendor,
        success: false,
        statusIndicator: null,
        incidents: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as StatusPageSummary;

    const incidents = data.incidents.map((incident) => ({
      externalId: incident.id,
      title: incident.name,
      status: incident.status,
      impact: incident.impact,
      url: incident.shortlink ?? null,
      startedAt: incident.created_at,
      resolvedAt: incident.resolved_at ?? null,
      components: [] as string[],
      raw: incident,
    }));

    return {
      vendor,
      success: true,
      statusIndicator: data.status.indicator,
      incidents,
    };
  } catch (error) {
    return {
      vendor,
      success: false,
      statusIndicator: null,
      incidents: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function fetchAllVendorStatuses(): Promise<VendorStatusResult[]> {
  const [telnyx, elevenlabs] = await Promise.all([
    fetchVendorStatus('telnyx'),
    fetchVendorStatus('elevenlabs'),
  ]);
  return [telnyx, elevenlabs];
}
