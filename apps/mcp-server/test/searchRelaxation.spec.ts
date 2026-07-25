import { describe, expect, it } from 'vitest';
import {
  buildEmptyState,
  coerceSearchInput,
  relatedModelsFor,
  requestedModels,
} from '../src/tools/searchRelaxation.js';

describe('search relaxation helpers', () => {
  it('splits comma/and model strings into models[]', () => {
    const coerced = coerceSearchInput({
      location: 'Rock Hill, SC',
      condition: 'used',
      make: 'Jeep',
      model: 'Cherokee and Wrangler',
    });
    expect(coerced.models).toEqual(['Cherokee', 'Wrangler']);
    expect(coerced.model).toBe('Cherokee');
  });

  it('prefers models array when requesting models', () => {
    expect(
      requestedModels({
        location: 'Rock Hill, SC',
        condition: 'used',
        model: 'Wrangler',
        models: ['Cherokee', 'Wrangler'],
      }),
    ).toEqual(['Cherokee', 'Wrangler']);
  });

  it('returns related Jeep models', () => {
    expect(relatedModelsFor('Wrangler')).toContain('Cherokee');
    expect(relatedModelsFor('Cherokee')).toContain('Wrangler');
  });

  it('builds an empty-state message with relaxations', () => {
    const empty = buildEmptyState({
      originalParams: {
        location: 'Fort Mill, SC',
        condition: 'used',
        make: 'Jeep',
        model: 'Wrangler',
        maxPrice: 30000,
        radiusMiles: 75,
      },
      effectiveParams: {
        location: 'Fort Mill, SC',
        condition: 'used',
        make: 'Jeep',
        radiusMiles: 250,
      },
      relaxations: [
        { step: 'drop_max_price', detail: 'Removed max price filter ($30,000)' },
        { step: 'widen_radius', detail: 'Expanded radius to 250 miles' },
      ],
    });
    expect(empty.title).toBe('No vehicles found');
    expect(empty.message).toContain('Jeep Wrangler');
    expect(empty.message).toContain('Removed max price filter');
  });
});
