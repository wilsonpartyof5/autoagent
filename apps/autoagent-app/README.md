# AutoAgent ChatGPT App Manifest

This directory contains the canonical manifest.json file for the AutoAgent ChatGPT App.

## File Structure

- `manifest.json` - The Apps SDK manifest file that defines tools, widgets, and connectors

## Source of Truth

**This manifest.json file is the single source of truth** for the ChatGPT App configuration.

- The API route at `/apps/dealer-dashboard/src/app/api/app-manifest/route.ts` reads from this file
- The MCP server tools in `/apps/mcp-server/src/mcp-simple.ts` must match the tool schemas defined here
- Widget implementations in `/apps/mcp-server/src/ui/` must match the widget definitions here

## Schema Synchronization

When updating tool schemas, ensure consistency across three locations:

1. **Implementation** (`/apps/mcp-server/src/tools/*.ts`) - Zod schemas in tool files
2. **MCP Handler** (`/apps/mcp-server/src/mcp-simple.ts`) - Tool inputSchema definitions
3. **Manifest** (`apps/autoagent-app/manifest.json`) - Tool definitions in manifest

## Validation

After installing `@openai/applications-sdk`, validate the manifest:

```bash
# Install dependencies (if not already done)
pnpm install

# Locate the SDK schema file
find node_modules/@openai/applications-sdk -name "manifest.schema.json"

# Validate manifest.json against schema (if SDK provides validation tool)
# This depends on what the SDK exposes
```

## Tools Defined

- `search-vehicles` - Search for vehicles by location, price, make, model, etc.
- `submit-lead` - Submit a lead for a vehicle test drive or quote request

## Widgets Defined

- `vehicle-results` - Interactive vehicle results widget with map and lead form

## Next Steps

1. ✅ Manifest.json created
2. ✅ Package.json updated with Apps SDK dependency
3. ✅ API route updated to read from manifest.json
4. ⏳ Run `pnpm install` to install `@openai/applications-sdk`
5. ⏳ Validate manifest.json against SDK schema once installed
6. ⏳ Test manifest loading in ChatGPT

