import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

function filesIn(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...filesIn(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.css')) {
      if (!entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) found.push(full);
    }
  }
  return found;
}

test('sprint hq source does not embed secrets or copy internal evidence paths', () => {
  const files = filesIn(root);
  assert.ok(files.length > 5);
  const forbidden = [
    /@supabase/,
    /supabase\.co/,
    /createClient\s*\(/,
    /ghp_/,
    /github_pat_/,
    /sk-[A-Za-z0-9]{16,}/,
    /service_role/,
    /BEGIN PRIVATE/,
    /\/workspace\/drevvy/,
    /eyJ[a-zA-Z0-9_-]{10,}/,
    /postgres:\/\//,
    /64%/,
    /3d 14h/,
  ];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    const serverAdapter = relative === path.join('live', 'load.ts');
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${relative} matched ${pattern}`);
    }
    if (!serverAdapter) {
      assert.equal(/fetch\s*\(/.test(source), false, relative);
      assert.equal(/process\.env/.test(source), false, relative);
      assert.equal(source.includes('https://'), false, relative);
      assert.equal(source.includes('http://'), false, relative);
      assert.equal(source.includes('SPRINT_HQ_GITHUB_TOKEN'), false, relative);
      assert.equal(source.includes('live/load'), false, relative);
    }
  }
  const adapter = readFileSync(path.join(root, 'live', 'load.ts'), 'utf8');
  assert.match(adapter, /https:\/\/api\.github\.com/);
  assert.match(adapter, /SPRINT_HQ_GITHUB_TOKEN/);
  assert.equal(adapter.includes('ghp_'), false);
  const page = readFileSync(path.resolve(root, '../app/admin/sprint/page.tsx'), 'utf8');
  const client = readFileSync(path.join(root, 'components', 'sprint-hq-app.tsx'), 'utf8');
  assert.match(page, /loadLiveBoard/);
  assert.equal(client.includes('loadLiveBoard'), false);
  assert.equal(client.includes('SPRINT_HQ_GITHUB_TOKEN'), false);
});
