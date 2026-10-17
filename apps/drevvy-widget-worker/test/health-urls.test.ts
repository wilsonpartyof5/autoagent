import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseUrlList } from '../src/cli/format';

describe('health url placeholder', () => {
  it('lists three public dealer vehicle pages', () => {
    const file = path.join(__dirname, '../examples/health-urls.txt');
    const targets = parseUrlList(readFileSync(file, 'utf8'));
    assert.equal(targets.length, 3);
    for (const target of targets) {
      const url = new URL(target.url);
      assert.equal(url.protocol, 'https:');
      assert.match(url.pathname, /^\/viewdetails\/(?:used|cpo)\//);
      assert.equal(target.stockNumber && target.stockNumber.length > 0, true);
    }
    const hosts = new Set(targets.map((target) => new URL(target.url).hostname));
    assert.equal(hosts.size, 3);
  });
});
