import { searchVehicles } from './tools/searchVehicles.js';
import { submitLead } from './tools/submitLead.js';
import { pingUi } from './tools/pingUi.js';
import { pingMicroUi } from './tools/pingMicroUi.js';

/**
 * Simple MCP tool handler for Express integration
 */
export async function handleMcpToolCall(toolName: string, args: unknown, context?: { ipAddress?: string }) {
  switch (toolName) {
    case 'search-vehicles':
      return await searchVehicles(args);
    case 'submit-lead':
      return await submitLead(args, context);
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
            description: 'ID of the dealer (optional)',
          },
          user: {
            type: 'object',
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
        required: ['vehicleId', 'vin', 'user', 'consent'],
      },
    },
  ];
}

/**
 * Get available resources
 */
export function getAvailableResources() {
  return [];
}
