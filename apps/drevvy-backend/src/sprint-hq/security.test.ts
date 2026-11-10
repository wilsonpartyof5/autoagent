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

test('sprint hq source does not fetch, embed secrets, or copy internal evidence paths', () => {
  const files = filesIn(root);
  assert.ok(files.length > 5);
  const forbidden = [
    /fetch\s*\(/,
    /@supabase/,
    /supabase\.co/,
    /createClient\s*\(/,
    /process\.env/,
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
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${path.relative(root, file)} matched ${pattern}`);
    }
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) {
      assert.equal(source.includes('https://'), false, file);
      assert.equal(source.includes('http://'), false, file);
    }
  }
});
