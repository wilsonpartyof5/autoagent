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
    expect(html).toContain('#app{position:relative;width:100%;height:420px;min-height:380px');
    expect(html).toContain('Math.max(380,Math.ceil($(\'app\')?.getBoundingClientRect().height||420))');
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

  it('renders dark vertical cards with image, price, mileage, and distance', () => {
    expect(html).toContain('.vehicle-card{background:var(--panel);color:var(--text)');
    expect(html).toContain('display:flex;flex-direction:column');
    expect(html).toContain('.vehicle-card img{display:block;width:100%;flex:1 1 0;min-height:140px');
    expect(html).toContain('#railShell{position:relative;display:grid;grid-template-columns:44px minmax(0,1fr) 44px;grid-template-rows:minmax(0,1fr)');
    expect(html).toContain('align-items:stretch');
    expect(html).toContain('#rail .vehicle-card{flex:1 0 188px;max-width:240px;min-width:168px;height:auto;align-self:stretch');
    expect(html).toContain('.rail-nav{display:none}');
    expect(html).toContain("class=\"copy\"><div class=\"vehicle-price\">");
    expect(html).toContain('function distanceMiles(v)');
    expect(html).toContain('v.distanceMiles??v.location?.dealer?.distanceMiles');
    expect(html).toContain('mi away');
    expect(html).toContain('class="vehicle-distance"');
    expect(html).toContain('${miles(v)?`${miles(v).toLocaleString()} mi`:\'New\'}');
    expect(html).toContain('function vehiclesForRail()');
    expect(html).toContain('function scrollRailToSelected()');
    expect(html).toContain('list.unshift(selected)');
    expect(html).not.toContain('background:#fff;color:#111');
  });

  it('opens a full-bleed VDP on both inline desktop and mobile', () => {
    expect(html).toContain('#details.drawer{display:flex;flex-direction:column;padding:0;overflow:hidden;background:var(--bg)}');
    expect(html).toContain('#details .drawer-panel{display:flex;flex-direction:column;width:100%;height:100%;max-width:none;margin:0;border-radius:0');
    expect(html).not.toContain('#details .drawer-panel{max-width:820px;margin:24px auto');
    expect(html).not.toContain('#details.drawer{padding:0 16px;background:#0e1013cc}');
    expect(html).toContain('.hero-image{display:block;width:100%;aspect-ratio:16/10');
    expect(html).toContain('body.fullscreen .hero-image{aspect-ratio:16/9}');
    expect(html).toContain('#rail .vehicle-card,.load-more-card{flex:1 0 156px;max-width:200px;min-width:148px}');
    expect(html).toContain('#rail .vehicle-card,.load-more-card{flex:1 0 200px;max-width:260px;min-width:180px}');
  });

  it('opens card details immediately without waiting for host fullscreen', () => {
    expect(html).toContain('function openCardDetails(id)');
    expect(html).toContain('openDetails(id)');
    expect(html).toContain("if(state.displayMode!=='fullscreen')void setDisplayMode('fullscreen',true)");
    expect(html).not.toContain("if(state.displayMode!=='fullscreen')await setDisplayMode('fullscreen',true)");
    expect(html).toContain('function openCardFromUi(id,source');
    expect(html).toContain("openCardFromUi(cardNode.dataset.id,'card')");
    expect(html).toContain("document.addEventListener('pointerup'");
    expect(html).toContain('#rail .vehicle-card{flex:1 0 188px;max-width:240px;min-width:168px;height:auto;align-self:stretch;touch-action:pan-x;cursor:pointer');
    expect(html).toContain("if(down.pointerType!=='mouse'||down.button!==0)return");
    expect(html).toContain('id="detailFooter" class="vdp-footer-nav"');
    expect(html).toContain('aria-label="Back to results"');
    expect(html).toContain('>Results</button>');
    expect(html).not.toContain('position:sticky;bottom:0');
    expect(html).not.toContain('.vdp-footer-nav{flex-direction:column}');
  });

  it('keeps ChatGPT revisions on the current widget', () => {
    expect(html).toContain("if(hostMode==='inline'&&state.displayMode==='fullscreen')setDisplayMode('inline',false)");
    expect(html).not.toContain("if(hostMode==='inline'&&state.displayMode==='fullscreen'){closeDetails();setDisplayMode('inline',false)}");
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
