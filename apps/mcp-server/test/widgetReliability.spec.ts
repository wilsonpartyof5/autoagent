import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { VEHICLE_WIDGET_VERSION } from '../src/mcp-simple.js';

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
    expect(html).toContain(`autoagent-widget-version" content="${VEHICLE_WIDGET_VERSION}"`);
    expect(html).toContain(`VERSION='${VEHICLE_WIDGET_VERSION}'`);
  });

  it('does not load a map, Leaflet, or search-this-area chrome', () => {
    expect(html).not.toContain('leaflet');
    expect(html).not.toContain('openstreetmap');
    expect(html).not.toContain('MapController');
    expect(html).not.toContain('id="map"');
    expect(html).not.toContain('id="searchArea"');
    expect(html).not.toContain('.price-pin');
    expect(html).not.toContain('.cluster-pin');
    expect(html).not.toContain("callSearch(args,'map-move',true)");
  });

  it('uses one hydration controller and keeps attaching to a late bridge', () => {
    expect(html.match(/function hydrate\(/g)).toHaveLength(1);
    expect(html).toContain('function attachBridge()');
    expect(html).toContain('setInterval(()=>');
    expect(html).toContain("receive(window.openai?.toolOutput,'poll.output')");
    expect(html).toContain('function selfFetchVehicles');
    expect(html).toContain('function cancelSelfFetch()');
    expect(html).toContain('cancelSelfFetch();');
    expect(html).toContain("event('hydrate:empty'");
  });

  it('supports fullscreen, native follow-ups, and persistent widget state', () => {
    expect(html).toContain("requestDisplayMode({mode})");
    expect(html).toContain('sendFollowUpMessage');
    expect(html).toContain('setWidgetState');
  });

  it('reports a compact carousel intrinsic height', () => {
    expect(html).toContain('notifyIntrinsicHeight(appHeight)');
    expect(html).toContain('new ResizeObserver');
    expect(html).toContain('#app{position:relative;width:100%;height:300px;min-height:260px');
    expect(html).toContain('Math.max(260,Math.ceil($(\'app\')?.getBoundingClientRect().height||300))');
  });

  it('starts with 8 cards and lets shoppers progressively load the complete result set', () => {
    expect(html).toContain('.control-scroll{display:none}');
    expect(html).toContain('const RAIL_CARD_LIMIT=8');
    expect(html).toContain('list.slice(0,state.cardLimit)');
    expect(html).toContain('See more inventory');
    expect(html).toContain('inventoryProgress');
    expect(html).toContain('Showing ${shown.toLocaleString()} of ${state.totalCount.toLocaleString()} · See all');
    expect(html).toContain('async function showMoreInventory()');
    expect(html).toContain("callSearch({pageOffset:state.all.length},'load-more',true)");
    expect(html).toContain("String(source).includes('load-more')");
  });

  it('renders compact cards with image, price, mileage, and distance', () => {
    expect(html).toContain('#rail .vehicle-card{flex-basis:340px}');
    expect(html).toContain('.rail-nav{display:none}');
    expect(html).toContain("class=\"copy\"><div class=\"vehicle-price\">");
    expect(html).toContain('function distanceMiles(v)');
    expect(html).toContain('v.distanceMiles??v.location?.dealer?.distanceMiles');
    expect(html).toContain('mi away');
    expect(html).toContain('${miles(v)?`${miles(v).toLocaleString()} mi`: \'New\'}${distanceLabel(v)}');
    expect(html).toContain('function vehiclesForRail()');
    expect(html).toContain('function scrollRailToSelected()');
    expect(html).toContain('list.unshift(selected)');
  });

  it('opens card details in fullscreen', () => {
    expect(html).toContain('async function openCardDetails(id)');
    expect(html).toContain("if(state.displayMode!=='fullscreen')await setDisplayMode('fullscreen',true)");
    expect(html).toContain('openCardDetails(cardNode.dataset.id)');
    expect(html).toContain('id="detailFooter" class="vdp-footer-nav"');
    expect(html).toContain('aria-label="Back to results"');
    expect(html).toContain('>Results</button>');
    expect(html).not.toContain('position:sticky;bottom:0');
    expect(html).not.toContain('.vdp-footer-nav{flex-direction:column}');
  });

  it('keeps ChatGPT revisions on the current widget', () => {
    expect(html).toContain("if(hostMode==='inline'&&state.displayMode==='fullscreen'){closeDetails();setDisplayMode('inline',false)}");
    expect(html).toContain('hideStatus();closeDetails();renderAll()');
    expect(html).not.toContain('scrollToBottom:true');
    expect(html).toContain("callSearch({make:make(v),model:model(v)},'more-like')");
    expect(html).not.toContain("callTool('search-vehicles'");
    expect(html).toContain("callTool('render-vehicle-results-v2'");
  });

  it('validates postMessage source and reports UX diagnostics', () => {
    expect(html).toContain('if(message.source!==window.parent)return');
    expect(html).toContain("event('image:loaded'");
    expect(html).toContain("event('image:error'");
    expect(html).not.toContain("event('map:bounds'");
  });

  it('preserves the original filters through recovery searches', () => {
    expect(html).toContain('originalQuery:{}');
    expect(html).toContain('mergeDefined(state.originalQuery,baseOriginal)');
    expect(html).toContain('captureHostSearchParams();');
    expect(html).toContain('if(resolved.maxPrice)params.maxPrice=resolved.maxPrice');
    expect(html).toContain('if(resolved.mileageMax)params.mileageMax=resolved.mileageMax');
    expect(html).toContain('...state.originalQuery,...state.query,...overrides');
    expect(html).toContain('if(resolved.bodyStyle)params.bodyStyle=resolved.bodyStyle');
  });

  it('tries alternate vehicle photos before the final placeholder', () => {
    expect(html).toContain('data-images=');
    expect(html).toContain("event('image:fallback'");
    expect(html).toContain('nextIndex<candidates.length');
  });
});
