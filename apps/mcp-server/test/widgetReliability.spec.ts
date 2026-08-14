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
    expect(html).toContain('autoagent-widget-version" content="v31"');
    expect(html).toContain("VERSION='v31'");
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

  it('clusters overlapping pins and auto-refreshes inventory after map moves', () => {
    expect(html).toContain('this.renderMarkers()');
    expect(html).toContain('addClusterPin');
    expect(html).not.toContain('pinOffset(index,count)');
    expect(html).toContain("callSearch(args,'map-move',true)");
    expect(html).toContain("callSearch(MapController.boundsArgs(),'search-area')");
    expect(html).toContain('markers:new Map()');
  });

  it('fits the initial map to about 10 miles around the search city or user location', () => {
    expect(html).toContain('const DEFAULT_VIEW_MILES=10');
    expect(html).toContain('cityCenterFromLocation');
    expect(html).toContain("'charlotte, nc':[35.2271,-80.8431]");
    expect(html).toContain('L.latLng(center).toBounds(DEFAULT_VIEW_MILES*1609.344*2)');
    expect(html).toContain('MapController.render(!/map-move|search-area/.test(String(source)))');
  });

  it('hides mobile filter chips and keeps an 8-card rail with dense map pins', () => {
    expect(html).toContain('.control-scroll{display:none}');
    expect(html).toContain('const RAIL_CARD_LIMIT=8');
    expect(html).toContain('.slice(0,RAIL_CARD_LIMIT)');
    expect(html).toContain('if(fit)this.fit();this.renderMarkers()');
  });

  it('uses compact Zillow-like cards and high-contrast map pins', () => {
    expect(html).toContain('#rail .vehicle-card{flex:0 0 calc(100% - 28px)');
    expect(html).toContain('.rail-nav{display:none}');
    expect(html).toContain('.price-pin{position:relative;transform:translate(-50%,-100%);background:#111;color:#fff');
    expect(html).toContain('-webkit-text-fill-color:#fff');
    expect(html).toContain("class=\"copy\"><div class=\"vehicle-price\">");
    expect(html).toContain('.cluster-pin{transform:translate(-50%,-50%);width:34px;height:34px');
    expect(html).toContain('background:#111;color:#fff;-webkit-text-fill-color:#fff;border:2px solid #fff');
  });

  it('loads the tapped map pin into the carousel', () => {
    expect(html).toContain("selectVehicle(vehicle.id,'pin')");
    expect(html).toContain("selectVehicle(match.id,'cluster')");
    expect(html).toContain('function vehiclesForRail()');
    expect(html).toContain('function scrollRailToSelected()');
    expect(html).toContain("if(source==='pin'||source==='cluster')requestAnimationFrame(()=>scrollRailToSelected())");
    expect(html).toContain('list.unshift(selected)');
  });

  it('validates postMessage source and reports UX diagnostics', () => {
    expect(html).toContain('if(message.source!==window.parent)return');
    expect(html).toContain("event('image:loaded'");
    expect(html).toContain("event('image:error'");
    expect(html).toContain("event('map:bounds'");
  });
});
