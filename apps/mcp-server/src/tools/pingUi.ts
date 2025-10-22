import { validateToolResult } from '../lib/responseShape.js';

/**
 * Ping UI tool for ChatGPT App validation
 * Returns a simple iframe component to test UI loading
 */
export async function pingUi(): Promise<{
  success: boolean;
  data?: {
    content: Array<{ type: string; text: string }>;
    components: Array<{ type: string; url: string }>;
  };
  error?: string;
}> {
  try {
    const { randomUUID } = await import('crypto');
    const runId = randomUUID();
    const widgetHost = process.env.WIDGET_HOST || 'https://rana-flightiest-malcolm.ngrok-free.dev';
    const pingUrl = `${widgetHost}/widget/ping?rid=${encodeURIComponent(runId)}&diag=1`;
    
    console.log(JSON.stringify({ evt:'diag.tool', runId, url: pingUrl, ts: Date.now() }));
    
    const toolResult = {
      success: true,
      data: {
        content: [{ type: 'text', text: `Pinging UI (run ${runId})` }],
        components: [
          { type: 'iframe', url: pingUrl }
        ]
      },
      error: undefined
    };
    
    // Validate the result shape
    validateToolResult(toolResult.data);
    
    return toolResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
