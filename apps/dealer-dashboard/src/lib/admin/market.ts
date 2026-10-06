import { callMcpTool } from '@/lib/marketcheck/mcp-client';

import type { DemoVehicle, MarketComp, MarketInsight } from './types';

const RADIUS_MILES = 50;

export function mockMarketInsight(vehicle: DemoVehicle): MarketInsight {
  const seed = hash(vehicle.vin);
  const daysOnMarket = 12 + (seed % 70);
  const priceDropCount = seed % 4;
  const lastDropAmount = priceDropCount > 0 ? 250 + (seed % 8) * 100 : null;
  const comparableCount = 2 + (seed % 6);
  const comps = Array.from({ length: Math.min(3, comparableCount) }, (_, index) => {
    const delta = 400 + ((seed + index * 17) % 2200);
    const lower = index !== 2;
    return {
      label: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`,
      price: Math.max(1000, vehicle.price + (lower ? -delta : Math.round(delta / 3))),
      miles: 8000 + ((seed + index * 91) % 42000),
      distanceMiles: 6 + ((seed + index * 13) % 44),
      daysOnMarket: 5 + ((seed + index) % 40),
    } satisfies MarketComp;
  });
  const lowest = Math.min(...comps.map((comp) => comp.price));
  const lowestCompDelta = lowest - vehicle.price;
  const leverageScore = Math.max(8, Math.min(96, Math.round(
    (comparableCount * 8) + (priceDropCount * 10) + Math.min(40, Math.abs(lowestCompDelta) / 100),
  )));
  const cheaper = comps.filter((comp) => comp.price < vehicle.price);
  const citation = cheaper.length > 0
    ? `${cheaper.length} similar ${vehicle.make} ${vehicle.model} units within ${RADIUS_MILES}mi are listed about ${usd(vehicle.price - Math.min(...cheaper.map((comp) => comp.price)))} lower.`
    : `${comparableCount} similar units within ${RADIUS_MILES}mi. This listing is already near the bottom of the set.`;

  return {
    source: 'mock',
    daysOnMarket,
    priceDropCount,
    lastDropAmount,
    comparableCount,
    radiusMiles: RADIUS_MILES,
    lowestCompDelta,
    leverageScore,
    citation,
    comps,
  };
}

/**
 * Market data for a deal. Live MarketCheck runs only when MARKETCHECK_LIVE=1.
 * Any failure falls back to the fixture insight so the admin page still renders.
 */
export async function getMarketInsight(vehicle: DemoVehicle): Promise<MarketInsight> {
  if (process.env.MARKETCHECK_LIVE !== '1') return mockMarketInsight(vehicle);
  try {
    const live = await callMcpTool<{ listings?: Array<{ price?: number; miles?: number; dom?: number }> }>(
      'search_active_cars',
      {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        rows: 5,
        start: 0,
      },
    );
    const listings = live?.listings ?? [];
    if (listings.length === 0) return mockMarketInsight(vehicle);
    const base = mockMarketInsight(vehicle);
    const prices = listings.map((listing) => listing.price).filter((price): price is number => typeof price === 'number');
    if (prices.length === 0) return base;
    const lowest = Math.min(...prices);
    return {
      ...base,
      source: 'live',
      comparableCount: listings.length,
      lowestCompDelta: lowest - vehicle.price,
      citation: `${listings.length} live MarketCheck comps for ${vehicle.year} ${vehicle.make} ${vehicle.model}. Lowest listed price is ${usd(lowest)}.`,
      comps: listings.slice(0, 3).map((listing, index) => ({
        label: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        price: listing.price ?? vehicle.price,
        miles: listing.miles ?? 0,
        distanceMiles: base.comps[index]?.distanceMiles ?? 10,
        daysOnMarket: listing.dom ?? base.daysOnMarket,
      })),
    };
  } catch (error) {
    console.warn(JSON.stringify({
      event: 'admin_marketcheck_fallback',
      message: error instanceof Error ? error.message : 'unknown',
    }));
    return mockMarketInsight(vehicle);
  }
}

function hash(value: string): number {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function usd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
