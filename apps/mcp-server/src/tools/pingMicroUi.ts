import { randomUUID as uuid } from 'crypto';
import { validateToolResult } from '../lib/responseShape.js';

export async function pingMicroUi() {
  const runId = uuid();
  const host = process.env.WIDGET_HOST!;
  const url = `${host}/widget/micro?rid=${encodeURIComponent(runId)}&diag=1`;

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
