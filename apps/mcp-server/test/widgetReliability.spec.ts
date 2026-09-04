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
    expect(html).toContain('autoagent-widget-version" content="v35"');
    expect(html).toContain("VERSION='v35'");
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

  it('clusters overlapping dealer pins and auto-refreshes inventory after map moves', () => {
    expect(html).toContain('this.renderMarkers()');
    expect(html).toContain('addClusterPin');
    expect(html).toContain('addDealerGroup');
    expect(html).toContain('const cell=zoom>=15?20:zoom>=13?28:36');
    expect(html).not.toContain('pinOffset(index,count)');
    expect(html).toContain('spiderOffset(index,count)');
    expect(html).toContain('this.render(false)');
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

  it('starts with 8 cards and lets shoppers progressively load the complete result set', () => {
    expect(html).toContain('.control-scroll{display:none}');
    expect(html).toContain('const RAIL_CARD_LIMIT=8');
    expect(html).toContain('list.slice(0,state.cardLimit)');
    expect(html).toContain('See more inventory');
    expect(html).toContain('async function showMoreInventory()');
    expect(html).toContain("callSearch({pageOffset:state.all.length},'load-more',true)");
    expect(html).toContain("String(source).includes('load-more')");
    expect(html).toContain('if(fit)this.fit();this.renderMarkers()');
  });

  it('uses compact Zillow-like cards and high-contrast map pins', () => {
    expect(html).toContain('#rail .vehicle-card{flex-basis:340px}');
    expect(html).toContain('.rail-nav{display:none}');
    expect(html).toContain('.price-pin{position:relative;transform:translate(-50%,-100%);background:#fff;color:#111');
    expect(html).toContain('-webkit-text-fill-color:#111');
    expect(html).toContain("class=\"copy\"><div class=\"vehicle-price\">");
    expect(html).toContain('.cluster-pin{transform:translate(-50%,-50%);width:34px;height:34px');
    expect(html).toContain('background:#fff;color:#111;-webkit-text-fill-color:#111;border:2px solid #111');
  });

  it('loads the tapped map pin into the carousel', () => {
    expect(html).toContain("selectVehicle(vehicle.id,'pin')");
    expect(html).toContain("selectVehicle(match.id,'cluster')");
    expect(html).toContain('function vehiclesForRail()');
    expect(html).toContain('function scrollRailToSelected()');
    expect(html).toContain("if(source==='pin'||source==='cluster')requestAnimationFrame(()=>scrollRailToSelected())");
    expect(html).toContain('list.unshift(selected)');
  });

  it('opens card details in fullscreen so the VDP is not cramped over the inline map', () => {
    expect(html).toContain('async function openCardDetails(id)');
    expect(html).toContain("if(state.displayMode!=='fullscreen')await setDisplayMode('fullscreen',true)");
    expect(html).toContain('openCardDetails(cardNode.dataset.id)');
    expect(html).toContain('id="detailFooter" class="vdp-footer-nav"');
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
    expect(html).toContain("event('map:bounds'");
  });

  it('preserves the original filters through recovery and map searches', () => {
    expect(html).toContain('if(resolved.maxPrice)params.maxPrice=resolved.maxPrice');
    expect(html).toContain('if(resolved.mileageMax)params.mileageMax=resolved.mileageMax');
    expect(html).toContain("state.query.maxPrice||''");
    expect(html).toContain("state.query.bodyStyle||''");
  });

  it('tries alternate vehicle photos before the final placeholder', () => {
    expect(html).toContain('data-images=');
    expect(html).toContain("event('image:fallback'");
    expect(html).toContain('nextIndex<candidates.length');
  });
});
