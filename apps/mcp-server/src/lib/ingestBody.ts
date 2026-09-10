import { z } from 'zod';
import type { DeletionStrategy, IngestionServiceOptions } from '../ingestion/service.js';
import { resolveDeletionStrategy } from './ingestAuth.js';

const DeletionStrategySchema = z.enum([
  'none',
  'mark_unavailable',
  'delete_old',
  'delete_all_old',
]);

const TrustedIngestOptionsSchema = z
  .object({
    dealerId: z.string().min(1).optional(),
    dataSource: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().max(120_000).optional(),
    batchSize: z.number().int().positive().max(1_000).optional(),
    continueOnError: z.boolean().optional(),
    deletionStrategy: DeletionStrategySchema.optional(),
  })
  .strict();

export const IngestVehiclesBodySchema = z
  .object({
    vehicles: z.array(z.unknown()),
    options: TrustedIngestOptionsSchema.optional(),
  })
  .strict();

export const FetchAndIngestBodySchema = z
  .object({
    dealerId: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    page: z.number().int().min(1).optional(),
    maxPages: z.number().int().min(1).max(50).optional(),
    maxVehicles: z.number().int().min(1).max(20_000).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.dealerId || body.source), {
    message: 'dealerId or source is required',
  });

export function parseIngestVehiclesBody(input: unknown) {
  return IngestVehiclesBodySchema.safeParse(input);
}

export function parseFetchAndIngestBody(input: unknown) {
  return FetchAndIngestBodySchema.safeParse(input);
}

export function trustedIngestOptions(
  provider: IngestionServiceOptions['provider'],
  defaults: {
    dataSource: string;
    deletionStrategy: DeletionStrategy;
  },
  options?: z.infer<typeof TrustedIngestOptionsSchema>,
): IngestionServiceOptions {
  const dealerId = options?.dealerId;
  return {
    provider,
    dataSource: options?.dataSource || defaults.dataSource,
    timeoutMs: options?.timeoutMs || 30_000,
    batchSize: options?.batchSize || 100,
    continueOnError: options?.continueOnError !== false,
    dealerId,
    deletionStrategy: resolveDeletionStrategy(
      options?.deletionStrategy || defaults.deletionStrategy,
      dealerId,
      defaults.deletionStrategy,
    ),
  };
}
