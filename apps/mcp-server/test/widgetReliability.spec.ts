import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('vehicle widget reliability contract', () => {
  const html = readFileSync(
    join(process.cwd(), 'src', 'ui', 'vehicle-results.html'),
    'utf8',
  );
  const moduleScript = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] ?? '';

  it('contains syntactically valid controller JavaScript', () => {
    expect(moduleScript).not.toBe('');
    expect(() => new Function(moduleScript)).not.toThrow();
  });

  it('uses a fresh widget resource version', () => {
    expect(html).toContain('autoagent-widget-version" content="v30"');
    expect(html).toContain("VERSION='v30'");
  });

  it('uses one hydration controller and keeps attaching to a late bridge', () => {
    expect(html.match(/function hydrate\(/g)).toHaveLength(1);
    expect(html).toContain('function attachBridge()');
    expect(html).toContain('setInterval(()=>');
    expect(html).toContain("receive(window.openai?.toolOutput,'poll.output')");
    expect(html).toContain('function selfFetchVehicles');
    expect(html).toContain("event('hydrate:empty'");
  });

  it('supports fullscreen, native follow-ups, and persistent widget state', () => {
    expect(html).toContain("requestDisplayMode({mode})");
    expect(html).toContain('sendFollowUpMessage');
    expect(html).toContain('setWidgetState');
  });

  it('reports intrinsic height and gates map bounds on real dimensions and user input', () => {
    expect(html).toContain('notifyIntrinsicHeight(appHeight)');
    expect(html).toContain('new ResizeObserver');
    expect(html).toContain('rect.width<240||rect.height<240');
    expect(html).toContain('!this.userInteracted');
    expect(html).toContain("event('map:bounds-skipped'");
  });

  it('supports zoom-aware pins and Search this area', () => {
    expect(html).toContain("if(zoom<7)this.renderClusters();else this.renderPrices()");
    expect(html).toContain("callSearch(MapController.boundsArgs(),'search-area')");
    expect(html).toContain('markers:new Map()');
  });

  it('hides mobile filter chips and keeps an 8-card rail with dense map pins', () => {
    expect(html).toContain('.control-scroll{display:none}');
    expect(html).toContain('const RAIL_CARD_LIMIT=8');
    expect(html).toContain('.slice(0,RAIL_CARD_LIMIT)');
    expect(html).toContain('pinOffset(index,count)');
    expect(html).toContain('if(fit)this.fit();const zoom=this.map.getZoom()');
  });

  it('uses compact Zillow-like cards and high-contrast map pins', () => {
    expect(html).toContain('#rail .vehicle-card{flex:0 0 calc(100% - 28px)');
    expect(html).toContain('.rail-nav{display:none}');
    expect(html).toContain('.price-pin{position:relative;transform:translate(-50%,-100%);background:#111;color:#fff');
    expect(html).toContain("class=\"copy\"><div class=\"vehicle-price\">");
  });

  it('validates postMessage source and reports UX diagnostics', () => {
    expect(html).toContain('if(message.source!==window.parent)return');
    expect(html).toContain("event('image:loaded'");
    expect(html).toContain("event('image:error'");
    expect(html).toContain("event('map:bounds'");
  });
});
