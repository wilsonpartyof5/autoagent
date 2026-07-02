import { searchVehicles } from './tools/searchVehicles.js';
import { submitLead } from './tools/submitLead.js';
import { compareVehicles } from './tools/compareVehicles.js';
import { pingUi } from './tools/pingUi.js';
import { pingMicroUi } from './tools/pingMicroUi.js';
import { search } from './tools/search.js';
import { fetchContent } from './tools/fetch.js';
import { readFileSync } from 'fs';
import { join } from 'path';

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
      description: 'Search vehicle inventory from natural-language queries (e.g. "cars for sale near Rock Hill, SC")',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: 'ui://vehicle-results.html' },
        'openai/outputTemplate': 'ui://vehicle-results.html',
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
      name: 'search-vehicles',
      description: 'Search for vehicles based on location, price, make, model, and other criteria',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: 'ui://vehicle-results.html' },
        'openai/outputTemplate': 'ui://vehicle-results.html',
      },
      inputSchema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'Location to search for vehicles (e.g., "Seattle, WA", "New York, NY")',
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
        required: ['location', 'condition'],
      },
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
      uri: 'ui://vehicle-results.html',
      name: 'Vehicle Results Widget',
      description: 'Interactive widget displaying vehicle search results',
      mimeType: 'text/html',
    },
    {
      uri: 'ui://ping.html',
      name: 'Ping Widget',
      description: 'Minimal diagnostic UI for bridge readiness',
      mimeType: 'text/html',
    },
    {
      uri: 'ui://micro.html',
      name: 'Micro Widget',
      description: 'Ultra-minimal diagnostic UI',
      mimeType: 'text/html',
    },
  ];
}

export function readMcpResource(uri: string) {
  const [baseUri] = uri.split('?');
  const resources: Record<string, string> = {
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
        mimeType: 'text/html',
        text: readFileSync(path, 'utf8'),
      },
    ],
  };
}
