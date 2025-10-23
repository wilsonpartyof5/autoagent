# AutoAgent

AI-powered car discovery and lead-gen app that lives inside ChatGPT via the Apps SDK + MCP.

## 🎯 What We've Built

AutoAgent is a **production-ready ChatGPT App** that provides real-time vehicle search and lead generation capabilities. We've successfully integrated with the MarketCheck API to deliver live vehicle inventory data directly through ChatGPT's interface.

### ✅ Key Accomplishments

- **Real MarketCheck API Integration**: Live vehicle inventory with VINs, pricing, and dealer information
- **MCP Protocol Compliance**: Full ChatGPT App integration with tools and resources
- **Lead Capture System**: Secure PII encryption, rate limiting, and database storage
- **Interactive Widget**: Zillow-style map interface with vehicle cards and lead forms
- **Dealer Dashboard**: Next.js SaaS platform for lead management and analytics
- **Production Security**: Rate limiting, PII encryption, and error handling

## Architecture

- **MCP Server**: Node.js/Express server exposing vehicle search tools and UI widgets
- **Dealer Dashboard**: Next.js SaaS dashboard for dealers (billing, analytics, lead management)
- **Shared Package**: Common types and schemas

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

### MCP Server

The MCP server runs on `http://localhost:8787` and exposes:

- **Tool**: `search-vehicles` - Search for vehicles with natural language queries
- **UI Resource**: `ui://vehicle-results.html` - Renders vehicle results as interactive cards

#### Environment Setup

Copy the example environment file:

```bash
cp apps/mcp-server/env.example apps/mcp-server/.env
```

Update the environment variables as needed.

#### MarketCheck Setup

The MCP server integrates with MarketCheck for **real vehicle inventory data**:

- **`MARKETCHECK_API_KEY`**: Your MarketCheck API key (required for real data)
- **`MARKETCHECK_BASE_URL`**: MarketCheck API base URL (configured to `https://api.marketcheck.com`)

**✅ Real Data Integration**: The system now pulls live vehicle inventory from MarketCheck with:
- Real VINs for lead tracking
- Live pricing from dealers
- Actual make/model/year data
- Dealer information and locations
- Real-time availability

**Production Ready**: No mock data fallback - system uses only real MarketCheck API data.

#### Development

```bash
# Start MCP server in development mode
pnpm --filter mcp-server dev

# Build for production
pnpm --filter mcp-server build

# Start production server
pnpm --filter mcp-server start
```

### Dealer Dashboard

```bash
# Start dealer dashboard
pnpm --filter dealer-dashboard dev
```

### Testing with ChatGPT

1. Start the MCP server: `pnpm --filter mcp-server dev`
2. Expose locally using ngrok: `npx ngrok http 8787`
3. Use the ngrok URL in your ChatGPT Connector setup

#### MCP Tool Usage

The `search-vehicles` tool accepts these parameters:
- `location` (required): Location to search (e.g., "Seattle, WA")
- `condition` (required): "new" or "used"
- `maxPrice` (optional): Maximum price in USD
- `make` (optional): Vehicle make (e.g., "Toyota")
- `model` (optional): Vehicle model (e.g., "Camry")
- `radiusMiles` (optional): Search radius in miles (default: 50)

The tool returns **real vehicle data** from MarketCheck with `structuredContent.results` that maps to the `ui://vehicle-results.html` widget for interactive display.

### 🔧 MCP Tools Available

1. **`search-vehicles`**: Search for real vehicles with live inventory data
2. **`submit-lead`**: Capture leads with VIN tracking and PII encryption

### 🎨 UI Resources

- **`ui://vehicle-results.html`**: Interactive Zillow-style widget with map and vehicle cards

## Project Structure

```
autoagent/
├── apps/
│   ├── mcp-server/          # MCP server (Node.js/Express)
│   └── dealer-dashboard/    # Dealer dashboard (Next.js)
├── packages/
│   └── shared/              # Shared types and schemas
├── .github/workflows/       # CI/CD
└── README.md
```

## 🚀 Production Features

### Security & Privacy
- **PII Encryption**: All user data encrypted with libsodium
- **Rate Limiting**: 5 leads per IP per 24 hours
- **VIN Validation**: Proper VIN format validation
- **Consent Management**: Required user consent for lead capture

### Performance & Reliability
- **Real-time Data**: Live MarketCheck API integration
- **Error Handling**: Graceful API failure handling
- **Caching**: LRU cache for search results (60s TTL)
- **Timeout Protection**: 5-second API timeout with proper error handling

### Lead Management
- **Database Storage**: SQLite with encrypted payloads
- **Dashboard Integration**: Automatic lead forwarding to dealer dashboard
- **Lead Tracking**: Full audit trail with timestamps
- **Dealer Analytics**: Lead volume and conversion tracking

## Development Scripts

- `pnpm build` - Build all packages
- `pnpm dev` - Start all development servers
- `pnpm lint` - Lint all packages
- `pnpm format` - Format code with Prettier
- `pnpm typecheck` - Type check all packages
- `pnpm test` - Run test suites
- `pnpm --filter mcp-server gen:key` - Generate encryption key

## 🎯 Why We Built This

AutoAgent solves the problem of **fragmented car buying experiences** by providing a unified, AI-powered platform that:

1. **Connects Buyers to Real Inventory**: Live MarketCheck data ensures users see actual available vehicles
2. **Streamlines Lead Generation**: Secure lead capture with VIN tracking for dealers
3. **Provides Interactive Experience**: Zillow-style interface within ChatGPT for seamless browsing
4. **Ensures Data Privacy**: End-to-end encryption and secure handling of PII
5. **Scales for Dealers**: Dashboard analytics and lead management for business growth

## 📚 Documentation

- **[API Documentation](API.md)** - Complete API reference and integration guide
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
- **[Changelog](CHANGELOG.md)** - Development history and feature releases

## 🛠️ Quick Commands

```bash
# Start development
pnpm dev

# Test the system
pnpm --filter mcp-server test

# Generate encryption key
pnpm --filter mcp-server gen:key

# Build for production
pnpm build
```

## License

Private - All rights reserved
# Railway deployment trigger Thu Oct 23 12:23:58 EDT 2025
