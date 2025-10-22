import { z } from 'zod';

// Vehicle schema
export const VehicleSchema = z.object({
  id: z.string(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  make: z.string().min(1),
  model: z.string().min(1),
  price: z.number().positive(),
  mileage: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url().optional(),
  features: z.array(z.string()).optional(),
  vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{11,17}$/i).optional(),
  dealer: z.object({
    name: z.string().min(1),
    address: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
});

// Lead schema
export const LeadSchema = z.object({
  vehicleId: z.string(),
  user: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    preferredTime: z.string().optional(),
  }),
});

// Search parameters schema
export const SearchParamsSchema = z.object({
  location: z.string().min(1),
  condition: z.enum(['new', 'used']),
  maxPrice: z.number().positive().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  radiusMiles: z.number().positive().max(500).optional(),
});

// TypeScript types derived from schemas
export type Vehicle = z.infer<typeof VehicleSchema>;
export type Lead = z.infer<typeof LeadSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;

// Search results schema
export const SearchResultsSchema = z.object({
  vehicles: z.array(VehicleSchema),
  totalCount: z.number().int().nonnegative(),
  searchParams: SearchParamsSchema,
});

export type SearchResults = z.infer<typeof SearchResultsSchema>;
