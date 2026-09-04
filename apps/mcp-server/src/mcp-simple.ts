import { searchVehicles } from './tools/searchVehicles.js';
import { submitLead } from './tools/submitLead.js';
import { compareVehicles } from './tools/compareVehicles.js';
import { pingUi } from './tools/pingUi.js';
import { pingMicroUi } from './tools/pingMicroUi.js';
import { search } from './tools/search.js';
import { renderVehicleResults } from './tools/renderVehicleResults.js';
import { getVehicleDetails } from './tools/getVehicleDetails.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CONFIG } from './config/env.js';

const MCP_APP_HTML_MIME = 'text/html;profile=mcp-app';
export const VEHICLE_WIDGET_VERSION = 'v35';
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

const VEHICLE_DETAILS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    vehicle: { type: 'object', description: 'Selected vehicle listing details' },
  },
  required: ['vehicle'],
};

const SUBMIT_LEAD_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    leadId: { type: 'string' },
    vehicleId: { type: 'string' },
    dealerId: { type: 'string' },
    vin: { type: 'string' },
    price: { type: 'number' },
    currency: { type: 'string' },
  },
  required: ['leadId', 'vehicleId', 'dealerId', 'vin', 'price', 'currency'],
};

/** One-sentence OpenAI form justifications. Must match annotations on each public tool. */
export const TOOL_HINT_JUSTIFICATIONS = {
  'render-vehicle-results-v2': {
    readOnlyHint:
      'This tool only retrieves live vehicle listings and never creates, updates, or sends data.',
    openWorldHint:
      'This tool does not change publicly visible internet state; it only reads inventory.',
    destructiveHint:
      'This tool cannot delete, overwrite, or otherwise irreversibly change data.',
  },
  'get-vehicle-details': {
    readOnlyHint:
      'This tool only loads one vehicle listing and never creates, updates, or sends data.',
    openWorldHint:
      'This tool does not change publicly visible internet state; it only reads listing details.',
    destructiveHint:
      'This tool cannot delete, overwrite, or otherwise irreversibly change data.',
  },
  'submit-lead': {
    readOnlyHint:
      'This tool creates a dealer lead and can email or HTTP-forward the user’s contact details.',
    openWorldHint:
      'The lead is stored in the Drevvy dashboard and sent to a third-party dealership outside Drevvy.',
    destructiveHint:
      'Creating a lead does not delete or overwrite records and is not an irreversible payment or access change.',
  },
} as const;

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
      description: 'Vehicle model (e.g., "Camry", "CR-V"). For multiple models, prefer models[].',
    },
    models: {
      type: 'array',
      items: { type: 'string' },
      description: 'Multiple models to search together (e.g. ["Cherokee","Wrangler"]). Use when the user asks for more than one model.',
    },
    radiusMiles: {
      type: 'number',
      description: 'Search radius in miles (default: 50)',
    },
    bodyStyle: {
      type: 'string',
      description: 'Optional body style ONLY when the user explicitly asks for one. Allowed: SUV, Sedan, Truck, Coupe, Hatchback, Wagon, Van, Convertible. Do not invent a body style for trucks/pickups unless the user said SUV/Sedan/etc.',
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
    pageOffset: {
      type: 'number',
      minimum: 0,
      description: 'Internal pagination offset used by the widget to load more results',
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
      throw new Error('The fetch tool is not available.');
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
 * Tools advertised on tools/list (imported by OpenAI Scan Tools).
 * Extra handlers in handleMcpToolCall stay callable for older ChatGPT threads.
 */
export function getAvailableTools() {
  return [
    {
      name: 'render-vehicle-results-v2',
      title: 'Search cars',
      description:
        'Find cars for sale near a city. Call once with location, condition (new or used), and optional make, model, models[], max price, and mileage. If the user does not name a city, use the ChatGPT-provided user location when it is available. Omit bodyStyle unless the user asked for SUV, Sedan, Truck, or similar. Returns an interactive map and listing cards.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: VEHICLE_RESULTS_RESOURCE_URI },
        'openai/outputTemplate': VEHICLE_RESULTS_RESOURCE_URI,
      },
      inputSchema: VEHICLE_SEARCH_INPUT_SCHEMA,
      outputSchema: VEHICLE_RESULTS_OUTPUT_SCHEMA,
    },
    {
      name: 'get-vehicle-details',
      title: 'Vehicle details',
      description:
        'Load photos, specifications, price, and dealer information for one vehicle by VIN or listing ID.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
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
      outputSchema: VEHICLE_DETAILS_OUTPUT_SCHEMA,
    },
    {
      name: 'submit-lead',
      title: 'Request a quote',
      description:
        'Send a quote or test-drive request to the dealership after the user provides name, email, and consent to be contacted.',
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
      outputSchema: SUBMIT_LEAD_OUTPUT_SCHEMA,
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
  ];
}

export function readMcpResource(uri: string) {
  const [baseUri] = uri.split('?');
  const resources: Record<string, string> = {
    [VEHICLE_RESULTS_RESOURCE_URI]: join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v33.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v32.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v31.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v30.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v29.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v28.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v27.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v26.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v25.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v24.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v23.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'ui://vehicle-results-v22.html': join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
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
