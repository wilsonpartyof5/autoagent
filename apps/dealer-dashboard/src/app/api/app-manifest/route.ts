import { NextResponse } from 'next/server';

// Constants for easy updates
const MCP_URL = 'https://autoagentmcp-server-production.up.railway.app/mcp';
const WIDGET_URL = 'https://autoagentmcp-server-production.up.railway.app/widget/vehicle-results';

export async function GET() {
  return NextResponse.json({
    schema_version: 'v1',
    name: 'AutoAgent Dealer Demo',
    description: 'Search Rock Hill GMC inventory and submit leads.',
    author: {
      name: 'AutoAgent',
      email: 'support@autoagent.com',
    },
    connectors: [
      {
        type: 'mcp',
        url: MCP_URL,
        tools: ['search-vehicles', 'submit-lead'],
      },
    ],
    ui: {
      widgets: [
        {
          name: 'vehicle-results',
          url: WIDGET_URL,
        },
      ],
    },
  });
}

