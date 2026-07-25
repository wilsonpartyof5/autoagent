import type { SearchParams } from '@autoagent/shared';

export type SearchRelaxation = {
  step: string;
  detail: string;
};

export type SearchEmptyState = {
  title: string;
  message: string;
  originalParams: SearchParams;
  effectiveParams: SearchParams;
  relaxations: SearchRelaxation[];
};

const RELATED_MODELS: Record<string, string[]> = {
  wrangler: ['Cherokee', 'Grand Cherokee', 'Gladiator'],
  cherokee: ['Grand Cherokee', 'Wrangler', 'Compass'],
  'grand cherokee': ['Cherokee', 'Wrangler'],
  gladiator: ['Wrangler', 'Cherokee'],
  compass: ['Cherokee', 'Renegade'],
  '4runner': ['Tacoma', 'Highlander'],
  explorer: ['Expedition', 'Escape'],
  'f-150': ['Ranger', 'Bronco'],
  f150: ['Ranger', 'Bronco'],
  camry: ['Corolla', 'RAV4'],
  'cr-v': ['HR-V', 'Pilot'],
  crv: ['HR-V', 'Pilot'],
};

/** Normalize model / models / "Cherokee and Wrangler" into a deduped list. */
export function coerceSearchInput(raw: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw };
  const collected: string[] = [];

  const pushModel = (value: unknown) => {
    if (typeof value !== 'string') return;
    const parts = value
      .split(/\s*(?:,|\/|&|\band\b|\bor\b)\s*/i)
      .map((part) => part.trim())
      .filter((part) => part && !/^(and|or)$/i.test(part));
    for (const part of parts) collected.push(part);
  };

  if (Array.isArray(next.models)) {
    for (const item of next.models) pushModel(item);
  }
  pushModel(next.model);

  const models = [...new Set(collected.map((item) => item.trim()).filter(Boolean))];
  if (models.length === 0) {
    delete next.models;
    return next;
  }

  next.models = models;
  next.model = models[0];
  return next;
}

export function requestedModels(searchParams: SearchParams): string[] {
  const fromArray = Array.isArray(searchParams.models)
    ? searchParams.models.map((item) => String(item).trim()).filter(Boolean)
    : [];
  if (fromArray.length) return [...new Set(fromArray)];
  if (searchParams.model?.trim()) return [searchParams.model.trim()];
  return [];
}

export function relatedModelsFor(model: string | undefined): string[] {
  if (!model) return [];
  const key = model.trim().toLowerCase();
  return RELATED_MODELS[key] ?? [];
}

export function buildEmptyState(args: {
  originalParams: SearchParams;
  effectiveParams: SearchParams;
  relaxations: SearchRelaxation[];
}): SearchEmptyState {
  const { originalParams, effectiveParams, relaxations } = args;
  const models = requestedModels(originalParams);
  const modelLabel = models.length ? models.join(' / ') : originalParams.model || 'vehicles';
  const makeLabel = originalParams.make ? `${originalParams.make} ` : '';
  const bits: string[] = [];
  if (originalParams.maxPrice) bits.push(`under $${Math.floor(originalParams.maxPrice).toLocaleString('en-US')}`);
  if (originalParams.radiusMiles) bits.push(`within ${originalParams.radiusMiles} miles`);
  if (originalParams.location) bits.push(`of ${originalParams.location}`);
  const constraint = bits.length ? ` ${bits.join(' ')}` : '';
  const relaxed = relaxations.length
    ? ` Tried: ${relaxations.map((item) => item.detail).join('; ')}.`
    : '';

  return {
    title: 'No vehicles found',
    message: `No ${makeLabel}${modelLabel}${constraint}.${relaxed} Ask ChatGPT to widen price, radius, or models.`,
    originalParams,
    effectiveParams,
    relaxations,
  };
}

export function buildReadableSearchContent(
  totalCount: number,
  vehicles: unknown[],
  location: string | undefined,
  emptyState?: SearchEmptyState,
  relaxations: SearchRelaxation[] = [],
): { type: string; text: string }[] {
  if (!vehicles.length || totalCount === 0) {
    const text = emptyState?.message
      ?? `Found 0 vehicles${location ? ` near ${location}` : ''}. Try widening price, radius, or models.`;
    return [{ type: 'text', text }];
  }

  const header = `Found ${totalCount} vehicles${location ? ` near ${location}` : ''}.`;
  const note = relaxations.length
    ? `\nExpanded search: ${relaxations.map((item) => item.detail).join('; ')}.`
    : '';
  return [{ type: 'text', text: `${header}${note}` }];
}
