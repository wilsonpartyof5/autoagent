import assert from 'node:assert/strict';
import test from 'node:test';

import { RESPONSE_TOOLS, TOOL_DEFINITIONS } from './tools';

test('response tools use strict structured parameters', () => {
  assert.equal(RESPONSE_TOOLS.length, TOOL_DEFINITIONS.length);
  assert.ok(RESPONSE_TOOLS.length >= 5);
  for (const tool of RESPONSE_TOOLS) {
    assert.equal(tool.type, 'function');
    assert.equal(tool.strict, true);
    const parameters = tool.parameters as {
      additionalProperties?: boolean;
      required?: string[];
      properties?: Record<string, unknown>;
    };
    assert.equal(parameters.additionalProperties, false);
    assert.deepEqual(parameters.required, Object.keys(parameters.properties ?? {}));
  }
});
