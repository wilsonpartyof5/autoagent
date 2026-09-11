import { describe, expect, it } from 'vitest';
import {
  parseFetchAndIngestBody,
  parseIngestVehiclesBody,
  trustedIngestOptions,
} from '../src/lib/ingestBody.js';

describe('ingest body validation', () => {
  it('rejects caller-controlled extra options', () => {
    const parsed = parseIngestVehiclesBody({
      vehicles: [],
      options: { dealerId: '1038994', trusted: true },
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts only the trusted option keys', () => {
    const parsed = parseIngestVehiclesBody({
      vehicles: [{ vin: '1FT' }],
      options: { dealerId: '1038994', deletionStrategy: 'mark_unavailable' },
    });
    expect(parsed.success).toBe(true);
  });

  it('requires dealerId or source for fetch-and-ingest', () => {
    expect(parseFetchAndIngestBody({}).success).toBe(false);
    expect(parseFetchAndIngestBody({ dealerId: '1038994' }).success).toBe(true);
    expect(parseFetchAndIngestBody({ source: 'hondacarsrockhill.com' }).success).toBe(true);
  });

  it('does not copy unknown fields into ingestion options', () => {
    const options = trustedIngestOptions(
      'marketcheck',
      { dataSource: 'marketcheck-api', deletionStrategy: 'mark_unavailable' },
      { dealerId: '1038994' },
    );
    expect(options).toEqual({
      provider: 'marketcheck',
      dataSource: 'marketcheck-api',
      timeoutMs: 30_000,
      batchSize: 100,
      continueOnError: true,
      dealerId: '1038994',
      deletionStrategy: 'mark_unavailable',
    });
    expect(options).not.toHaveProperty('dealershipId');
    expect(options).not.toHaveProperty('trusted');
  });

  it('accepts a rooftop UUID on fetch-and-ingest', () => {
    const parsed = parseFetchAndIngestBody({
      dealerId: '1038994',
      dealershipId: '11111111-1111-1111-1111-111111111111',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.dealershipId).toBe('11111111-1111-1111-1111-111111111111');
    }
  });

  it('rejects a non-UUID dealershipId', () => {
    expect(
      parseFetchAndIngestBody({ dealerId: '1038994', dealershipId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('copies dealershipId onto trusted ingest options when set', () => {
    const options = trustedIngestOptions(
      'marketcheck',
      { dataSource: 'marketcheck-api', deletionStrategy: 'mark_unavailable' },
      {
        dealerId: '1038994',
        dealershipId: '11111111-1111-1111-1111-111111111111',
      },
    );
    expect(options.dealershipId).toBe('11111111-1111-1111-1111-111111111111');
    expect(options.deletionStrategy).toBe('mark_unavailable');
  });
});
