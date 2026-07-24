import { z } from 'zod';

const currentYear = new Date().getFullYear() + 1;

export const PriceChangeSchema = z.object({
  price: z.number().nonnegative(),
  // ISO-8601 strings make Supabase JSON serialization simple and keep chat payload compact
  timestamp: z.string().datetime(),
  source: z.string().optional(),
});

export const DealerSchema = z.object({
  dealerId: z.string().optional(),
  name: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  address: z.string().optional(),
});

// Vehicle schema captures every metafield required for GPT search, UI rendering, and ops sync.
export const VehicleSchema = z.object({
  // Vehicle identity
  id: z.string(), // internal inventory id
  vin: z
    .string()
    .regex(/^[A-HJ-NPR-Z0-9]{11,17}$/i, 'VIN must be 11-17 characters without I/O/Q')
    .optional(),
  stockNumber: z.string().optional(),
  listingId: z.string().optional(),

  // Basic specs
  year: z.number().int().min(1900).max(currentYear),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),

  // Condition / type
  condition: z.enum(['new', 'used', 'certified']).optional(),
  bodyType: z.string().optional(),
  drivetrain: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),

  // Pricing
  price: z.number().nonnegative(),
  msrp: z.number().nonnegative().optional(),
  priceChangeHistory: z.array(PriceChangeSchema).optional(),

  // Mileage
  miles: z.number().int().nonnegative().optional(),

  // Dealer info
  dealer: DealerSchema,

  // Media
  photoUrls: z.array(z.string().url()).optional(),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(), // legacy consumers (widget/search) pull from this primary photo

  // Features & options
  features: z.array(z.string()).optional(),
  interiorColor: z.string().optional(),
  exteriorColor: z.string().optional(),
  certified: z.boolean().optional(),

  // Market data
  marketAveragePrice: z.number().nonnegative().optional(),
  daysOnMarket: z.number().int().nonnegative().optional(),
  source: z.string().optional(),

  // Operational sync metadata
  lastSyncedAt: z.string().datetime(),
  syncStatus: z.enum(['pending', 'in_progress', 'success', 'failed']).default('success'),
  dataSource: z.string().default('marketcheck-api'),

  // Lead tracking
  leadStatus: z.enum(['none', 'submitted', 'qualified', 'sold']).default('none'),
  lastLeadAt: z.string().datetime().optional(),
  leadId: z.string().optional(),

  // Audit
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
  bodyStyle: z.string().optional(),
  mileageMax: z.number().positive().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  mapBounds: z.object({
    north: z.number().min(-90).max(90),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    west: z.number().min(-180).max(180),
  }).optional(),
});

// TypeScript types derived from schemas
export type Dealer = z.infer<typeof DealerSchema>;
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
