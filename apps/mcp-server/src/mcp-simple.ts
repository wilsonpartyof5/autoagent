import { searchVehicles } from './tools/searchVehicles.js';
import { submitLead } from './tools/submitLead.js';
import { compareVehicles } from './tools/compareVehicles.js';
import { pingUi } from './tools/pingUi.js';
import { pingMicroUi } from './tools/pingMicroUi.js';
import { search } from './tools/search.js';
import { fetchContent } from './tools/fetch.js';
import { renderVehicleResults } from './tools/renderVehicleResults.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const MCP_APP_HTML_MIME = 'text/html;profile=mcp-app';
const VEHICLE_RESULTS_RESOURCE_URI = 'ui://vehicle-results-v9.html';

const WIDGET_CSP = {
  connectDomains: [
    'https://autoagentmcp-server-production.up.railway.app',
  ],
  resourceDomains: [
    'https://unpkg.com',
    'https://tile.openstreetmap.org',
    'https://vehicle-images.dealerinspire.com',
    'https://pictures.dealer.com',
    'https://www.myrockhillgmc.com',
  ],
};

const VEHICLE_RESULTS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'object',
      properties: {
        vehicles: { type: 'array', items: { type: 'object' } },
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
    case 'submit-lead':
      return await submitLead(args, context);
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
      name: 'render-vehicle-results',
      title: 'Render Vehicle Results',
      description: 'Render an interactive in-chat vehicle inventory UI with map pins, vehicle cards, bottom sheet, detail drawer, compare tray, and refinement controls. Use this when the user wants to see vehicle search results inside ChatGPT.',
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
      description: 'Search vehicle inventory and render the interactive in-chat map and vehicle cards UI.',
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
      name: 'submit-lead',
      description: 'Submit a lead for a vehicle test drive or quote request',
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
      name: 'Vehicle Results Widget',
      description: 'Interactive widget displaying vehicle search results',
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      // Legacy alias kept for compatibility while clients migrate.
      uri: 'ui://vehicle-results-v8.html',
      name: 'Vehicle Results Widget (v8 Legacy)',
      description: 'Legacy URI alias for vehicle search results widget',
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      // Legacy alias kept for compatibility while clients migrate.
      uri: 'ui://vehicle-results-v7.html',
      name: 'Vehicle Results Widget (v7 Legacy)',
      description: 'Legacy URI alias for vehicle search results widget',
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      // Legacy alias kept for compatibility while clients migrate.
      uri: 'ui://vehicle-results-v6.html',
      name: 'Vehicle Results Widget (v6 Legacy)',
      description: 'Legacy URI alias for vehicle search results widget',
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      // Legacy alias kept for compatibility while clients migrate.
      uri: 'ui://vehicle-results-v5.html',
      name: 'Vehicle Results Widget (v5 Legacy)',
      description: 'Legacy URI alias for vehicle search results widget',
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      // Legacy alias kept for compatibility while clients migrate.
      uri: 'ui://vehicle-results-v4.html',
      name: 'Vehicle Results Widget (v4 Legacy)',
      description: 'Legacy URI alias for vehicle search results widget',
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      // Legacy alias kept for compatibility while clients migrate.
      uri: 'ui://vehicle-results-v3.html',
      name: 'Vehicle Results Widget (v3 Legacy)',
      description: 'Legacy URI alias for vehicle search results widget',
      mimeType: MCP_APP_HTML_MIME,
    },
    {
      // Legacy alias kept for compatibility while clients migrate.
      uri: 'ui://vehicle-results.html',
      name: 'Vehicle Results Widget (Legacy)',
      description: 'Legacy URI alias for vehicle search results widget',
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
            csp: WIDGET_CSP,
          },
          'openai/widgetDescription': 'Interactive map and card-based vehicle inventory browser.',
          'openai/widgetPrefersBorder': true,
          'openai/widgetCSP': {
            connect_domains: WIDGET_CSP.connectDomains,
            resource_domains: WIDGET_CSP.resourceDomains,
            frame_domains: [],
          },
        },
      },
    ],
  };
}
