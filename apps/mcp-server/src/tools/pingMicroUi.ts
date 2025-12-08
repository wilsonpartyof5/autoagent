import { randomUUID as uuid } from 'crypto';
import { validateToolResult } from '../lib/responseShape.js';
import { getWidgetHost } from '../utils/getWidgetHost.js';

export async function pingMicroUi() {
  const runId = uuid();
  const host = getWidgetHost();
  
  // Build URL using URL API to ensure proper encoding
  const widgetUrl = new URL('/widget/micro', host);
  widgetUrl.searchParams.set('rid', runId);
  widgetUrl.searchParams.set('diag', '1');
  const url = widgetUrl.toString();

  console.log(JSON.stringify({ evt:'diag.tool', tool:'pingMicroUi', runId, url, ts: Date.now() }));

  const result = {
    success: true,
    data: {
      content: [{ type:'text', text: `Pinging MICRO UI (run ${runId})` }],
      components: [{ type:'iframe', url }]
    },
    error: undefined
  };

  // Validate the result shape
  validateToolResult(result.data);

  return result;
}
