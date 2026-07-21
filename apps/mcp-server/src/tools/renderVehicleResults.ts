import { searchVehicles } from './searchVehicles.js';
import type { ToolContext } from '../mcp-simple.js';

/**
 * Presentation tool for the ChatGPT Apps SDK vehicle-results widget.
 *
 * This intentionally wraps the data search instead of returning a separate
 * component shape: the widget template is linked from this tool's descriptor.
 */
export async function renderVehicleResults(params: unknown, context?: ToolContext) {
  return await searchVehicles(params, context);
}
