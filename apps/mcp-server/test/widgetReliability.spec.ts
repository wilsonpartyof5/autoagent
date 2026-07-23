import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('vehicle widget reliability contract', () => {
  const html = readFileSync(
    join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'utf8',
  );

  it('uses a fresh widget resource version', () => {
    expect(html).toContain('autoagent-widget-version" content="v19"');
    expect(html).toContain("const WIDGET_VERSION = 'v19'");
  });

  it('keeps attaching when ChatGPT injects the bridge late', () => {
    expect(html).toContain('function attachOpenAiListeners()');
    expect(html).toContain('setInterval(() => {');
    expect(html).toContain("updateResults(window.openai?.toolOutput, 'poll.toolOutput')");
  });

  it('reports image and hydration diagnostics', () => {
    expect(html).toContain("beacon('image:loaded'");
    expect(html).toContain("beacon('image:error'");
    expect(html).toContain("window.dispatchEvent(new CustomEvent('aa:results'");
  });
});
