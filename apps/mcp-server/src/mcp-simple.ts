import { searchVehicles } from './tools/searchVehicles.js';
import { submitLead } from './tools/submitLead.js';
import { compareVehicles } from './tools/compareVehicles.js';
import { pingUi } from './tools/pingUi.js';
import { pingMicroUi } from './tools/pingMicroUi.js';
import { search } from './tools/search.js';
import { fetchContent } from './tools/fetch.js';
import { renderVehicleResults } from './tools/renderVehicleResults.js';
import { getVehicleDetails } from './tools/getVehicleDetails.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CONFIG } from './config/env.js';

const MCP_APP_HTML_MIME = 'text/html;profile=mcp-app';
export const VEHICLE_WIDGET_VERSION = 'v22';
export const VEHICLE_RESULTS_RESOURCE_URI = `ui://vehicle-results-${VEHICLE_WIDGET_VERSION}.html`;

const STATIC_WIDGET_RESOURCE_DOMAINS = [
  'https://unpkg.com',
  'https://tile.openstreetmap.org',
  'https://vehicle-images.dealerinspire.com',
  'https://pictures.dealer.com',
  'https://d2v1gjawtegg5z.cloudfront.net',
  'https://www.myrockhillgmc.com',
];

export function getWidgetCsp() {
  const widgetHost = CONFIG.widgetHost.replace(/\/$/, '');
  const resourceDomains = [...STATIC_WIDGET_RESOURCE_DOMAINS];
  if (!resourceDomains.includes(widgetHost)) {
    resourceDomains.push(widgetHost);
  }
  return {
    connectDomains: [widgetHost],
    resourceDomains,
  };
}

export function getOpenAiWidgetCspMeta() {
  const csp = getWidgetCsp();
  return {
    'openai/widgetCSP': {
      connect_domains: csp.connectDomains,
      resource_domains: csp.resourceDomains,
      frame_domains: [],
    },
  };
}

const VEHICLE_RESULTS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'object',
      properties: {
        vehicles: { type: 'array', items: { type: 'object' } },
        dealerSummary: { type: 'array', items: { type: 'object' } },
        totalCount: { type: 'number' },
        searchParams: { type: 'object' },
      },
      required: ['vehicles', 'totalCount'],
    },
  },
  required: ['results'],
};

const VEHICLE_SEARCH_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    location: {
      type: 'string',
      description: 'Location to search for vehicles (e.g., "Seattle, WA", "Rock Hill, SC")',
    },
    condition: {
      type: 'string',
      enum: ['new', 'used'],
      description: 'Vehicle condition (new or used)',
    },
    maxPrice: {
      type: 'number',
      description: 'Maximum price in USD',
    },
    make: {
      type: 'string',
      description: 'Vehicle make (e.g., "Toyota", "Honda")',
    },
    model: {
      type: 'string',
      description: 'Vehicle model (e.g., "Camry", "CR-V")',
    },
    radiusMiles: {
      type: 'number',
      description: 'Search radius in miles (default: 50)',
    },
    bodyStyle: {
      type: 'string',
      description: 'Vehicle body style (e.g., "SUV", "Sedan", "Truck")',
    },
    mileageMax: {
      type: 'number',
      description: 'Maximum mileage',
    },
    latitude: {
      type: 'number',
      minimum: -90,
      maximum: 90,
      description: 'Optional map center latitude for Search this area',
    },
    longitude: {
      type: 'number',
      minimum: -180,
      maximum: 180,
      description: 'Optional map center longitude for Search this area',
    },
    mapBounds: {
      type: 'object',
      description: 'Visible map bounds for UI context and diagnostics',
      properties: {
        north: { type: 'number' },
        south: { type: 'number' },
        east: { type: 'number' },
        west: { type: 'number' },
      },
      required: ['north', 'south', 'east', 'west'],
    },
  },
  required: [],
};

export type ToolContext = {
  ipAddress?: string;
  locale?: string;
  userLocation?: {
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
    latitude?: string;
    longitude?: string;
  };
};

/**
 * Simple MCP tool handler for Express integration
 */
export async function handleMcpToolCall(toolName: string, args: unknown, context?: ToolContext) {
  switch (toolName) {
    case 'search':
      return await search(args, context);
    case 'fetch':
      return await fetchContent(args);
    case 'search-vehicles':
      return await searchVehicles(args, context);
    case 'render-vehicle-results':
      return await renderVehicleResults(args, context);
    case 'render-vehicle-results-v2':
      return await renderVehicleResults(args, context);
    case 'submit-lead':
      return await submitLead(args, context);
    case 'get-vehicle-details':
      return await getVehicleDetails(args);
    case 'compare-vehicles':
      return await compareVehicles(args, context);
    case 'ping-ui':
      return await pingUi();
    case 'ping-micro-ui':
      return await pingMicroUi();
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Get available tools
 */
export function getAvailableTools() {
  return [
    {
      name: 'search',
      title: 'Search',
      description: 'Search vehicle inventory from natural-language queries (e.g. "cars for sale near Rock Hill, SC")',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string',
          },
        },
        required: ['query'],
      },
      outputSchema: VEHICLE_RESULTS_OUTPUT_SCHEMA,
    },
    {
      name: 'fetch',
      description: 'Fetch content from a URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to fetch content from',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'ping-ui',
      description: 'Test UI component loading and ChatGPT bridge connectivity',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'ping-micro-ui',
      description: 'Ultra-minimal UI test with immediate ui:ready emission',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'render-vehicle-results-v2',
      title: `Render Vehicle Results ${VEHICLE_WIDGET_VERSION.toUpperCase()}`,
      description: `Current (${VEHICLE_WIDGET_VERSION}) UI tool for rendering the latest interactive in-chat vehicle inventory map, dealer clusters, vehicle cards, VDP details, and back-to-results navigation. Prefer this tool for visual vehicle browsing.`,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: VEHICLE_RESULTS_RESOURCE_URI },
        'openai/outputTemplate': VEHICLE_RESULTS_RESOURCE_URI,
      },
      inputSchema: VEHICLE_SEARCH_INPUT_SCHEMA,
      outputSchema: VEHICLE_RESULTS_OUTPUT_SCHEMA,
    },
    {
      name: 'search-vehicles',
      title: 'Search Vehicles',
      description: 'Data-only vehicle inventory search. Use render-vehicle-results-v2 when the user wants the interactive map and card UI.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      inputSchema: VEHICLE_SEARCH_INPUT_SCHEMA,
      outputSchema: VEHICLE_RESULTS_OUTPUT_SCHEMA,
    },
    {
      name: 'get-vehicle-details',
      title: 'Get Vehicle Details',
      description: 'Load current photos, specifications, pricing, and dealer details for a selected MarketCheck vehicle.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object',
        properties: {
          listingId: { type: 'string', description: 'MarketCheck listing ID' },
          vin: { type: 'string', description: 'Vehicle VIN' },
          flowId: { type: 'string', description: 'Search flow correlation ID' },
        },
        required: [],
      },
    },
    {
      name: 'submit-lead',
      title: 'Submit Vehicle Lead',
      description: 'Submit a lead for a vehicle test drive or quote request',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object',
        properties: {
          vehicleId: {
            type: 'string',
            description: 'ID of the vehicle',
          },
          vin: {
            type: 'string',
            pattern: '^[A-HJ-NPR-Z0-9]{11,17}$',
            description: 'Vehicle Identification Number (VIN)',
          },
          dealerId: {
            type: 'string',
            description: 'ID of the dealer (required)',
          },
          dealerName: {
            type: 'string',
            description: 'Name of the dealer (required)',
          },
          pricing: {
            type: 'object',
            description: 'Vehicle pricing information',
            properties: {
              price: {
                type: 'number',
                description: 'Vehicle price',
              },
              currency: {
                type: 'string',
                description: 'Currency code (ISO 3-letter, default: USD)',
                default: 'USD',
              },
            },
            required: ['price', 'currency'],
          },
          user: {
            type: 'object',
            description: 'User contact information',
            properties: {
              name: {
                type: 'string',
                description: 'Full name',
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'Email address',
              },
              phone: {
                type: 'string',
                description: 'Phone number (optional)',
              },
              preferredTime: {
                type: 'string',
                description: 'Preferred contact time (optional)',
              },
            },
            required: ['name', 'email'],
          },
          consent: {
            type: 'boolean',
            description: 'User consent to be contacted (must be true)',
          },
          searchResultToken: {
            type: 'string',
            description: 'Signed search-result token returned with MarketCheck inventory',
          },
        },
        required: ['vehicleId', 'vin', 'dealerId', 'dealerName', 'pricing', 'user', 'consent'],
      },
    },
    {
      name: 'compare-vehicles',
      description: 'Compare multiple vehicles by IDs or VINs',
      inputSchema: {
        type: 'object',
        properties: {
          vehicleIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of vehicle IDs to compare',
          },
          vins: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of VINs to compare (when vehicleIds not available)',
          },
          dealerId: {
            type: 'string',
            description: 'ID of the dealer (optional)',
          },
        },
        required: [],
      },
    },
  ];
}

/**
 * Get available resources
 */
export function getAvailableResources() {
  return [
    {
      uri: VEHICLE_RESULTS_RESOURCE_URI,
      name: `Vehicle Results Widget ${VEHICLE_WIDGET_VERSION.toUpperCase()}`,
      description: `Current ${VEHICLE_WIDGET_VERSION} interactive widget displaying vehicle search results`,
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      uri: 'ui://ping.html',
      name: 'Ping Widget',
      description: 'Minimal diagnostic UI for bridge readiness',
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      uri: 'ui://micro.html',
      name: 'Micro Widget',
      description: 'Ultra-minimal diagnostic UI',
      mimeType: MCP_APP_HTML_MIME,
    },
  ];
}

export function readMcpResource(uri: string) {
  const [baseUri] = uri.split('?');
  const resources: Record<string, string> = {
    [VEHICLE_RESULTS_RESOURCE_URI]: join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v21.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v20.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v19.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v18.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v17.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v16.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v15.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v14.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v13.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v12.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v11.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v10.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v9.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v8.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v7.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v6.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v5.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v4.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v3.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://ping.html': join(process.cwd(), 'src', 'ui', 'ping.html'),
    'ui://micro.html': join(process.cwd(), 'src', 'ui', 'micro.html'),
  };

  const path = resources[baseUri];
  if (!path) {
    throw new Error(`Resource not found: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: MCP_APP_HTML_MIME,
        text: readFileSync(path, 'utf8'),
        _meta: {
          ui: {
            csp: getWidgetCsp(),
          },
          'openai/widgetDescription': 'Interactive map and card-based vehicle inventory browser.',
          'openai/widgetPrefersBorder': true,
          ...getOpenAiWidgetCspMeta(),
        },
      },
    ],
  };
}
