export type ConditionFilter = 'new' | 'used' | 'certified';

export type DaysOnLotFilter = '0-14' | '15-30' | '31+' | 'any';

export interface InventoryFilters {
  condition: ConditionFilter[];
  bodyType: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minMsrp: number | null;
  maxMsrp: number | null;
  daysOnLot: DaysOnLotFilter;
  hasPhotos: boolean;
  hasSellerComments: boolean;
  hasOptions: boolean;
  stockNumber: string | null;
  vin: string | null;
}

export const DEFAULT_FILTERS: InventoryFilters = {
  condition: [],
  bodyType: [],
  minPrice: null,
  maxPrice: null,
  minMsrp: null,
  maxMsrp: null,
  daysOnLot: 'any',
  hasPhotos: false,
  hasSellerComments: false,
  hasOptions: false,
  stockNumber: null,
  vin: null,
};

/**
 * Parse filters from URL search params
 */
export function parseFiltersFromSearchParams(searchParams: URLSearchParams): InventoryFilters {
  const filters: InventoryFilters = { ...DEFAULT_FILTERS };

  // Condition (comma-separated)
  const conditionParam = searchParams.get('condition');
  if (conditionParam) {
    const conditions = conditionParam.split(',').filter((c): c is ConditionFilter =>
      ['new', 'used', 'certified'].includes(c)
    );
    filters.condition = conditions;
  }

  // Body type (comma-separated)
  const bodyTypeParam = searchParams.get('bodyType');
  if (bodyTypeParam) {
    filters.bodyType = bodyTypeParam.split(',').filter(Boolean);
  }

  // Price range
  const minPriceParam = searchParams.get('minPrice');
  if (minPriceParam) {
    const minPrice = Number.parseInt(minPriceParam, 10);
    if (!Number.isNaN(minPrice) && minPrice >= 0) {
      filters.minPrice = minPrice;
    }
  }

  const maxPriceParam = searchParams.get('maxPrice');
  if (maxPriceParam) {
    const maxPrice = Number.parseInt(maxPriceParam, 10);
    if (!Number.isNaN(maxPrice) && maxPrice >= 0) {
      filters.maxPrice = maxPrice;
    }
  }

  // MSRP range
  const minMsrpParam = searchParams.get('minMsrp');
  if (minMsrpParam) {
    const minMsrp = Number.parseInt(minMsrpParam, 10);
    if (!Number.isNaN(minMsrp) && minMsrp >= 0) {
      filters.minMsrp = minMsrp;
    }
  }

  const maxMsrpParam = searchParams.get('maxMsrp');
  if (maxMsrpParam) {
    const maxMsrp = Number.parseInt(maxMsrpParam, 10);
    if (!Number.isNaN(maxMsrp) && maxMsrp >= 0) {
      filters.maxMsrp = maxMsrp;
    }
  }

  // Days on lot
  const daysOnLotParam = searchParams.get('daysOnLot');
  if (daysOnLotParam && ['0-14', '15-30', '31+', 'any'].includes(daysOnLotParam)) {
    filters.daysOnLot = daysOnLotParam as DaysOnLotFilter;
  }

  // Boolean toggles
  filters.hasPhotos = searchParams.get('hasPhotos') === 'true';
  filters.hasSellerComments = searchParams.get('hasSellerComments') === 'true';
  filters.hasOptions = searchParams.get('hasOptions') === 'true';

  // Stock Number
  const stockNumberParam = searchParams.get('stockNumber');
  if (stockNumberParam) {
    filters.stockNumber = stockNumberParam.trim();
  }

  // VIN
  const vinParam = searchParams.get('vin');
  if (vinParam) {
    filters.vin = vinParam.trim().toUpperCase();
  }

  return filters;
}

/**
 * Convert filters to URL search params
 */
export function filtersToSearchParams(filters: InventoryFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.condition.length > 0) {
    params.set('condition', filters.condition.join(','));
  }

  if (filters.bodyType.length > 0) {
    params.set('bodyType', filters.bodyType.join(','));
  }

  if (filters.minPrice !== null) {
    params.set('minPrice', filters.minPrice.toString());
  }

  if (filters.maxPrice !== null) {
    params.set('maxPrice', filters.maxPrice.toString());
  }

  if (filters.minMsrp !== null) {
    params.set('minMsrp', filters.minMsrp.toString());
  }

  if (filters.maxMsrp !== null) {
    params.set('maxMsrp', filters.maxMsrp.toString());
  }

  if (filters.daysOnLot !== 'any') {
    params.set('daysOnLot', filters.daysOnLot);
  }

  if (filters.hasPhotos) {
    params.set('hasPhotos', 'true');
  }

  if (filters.hasSellerComments) {
    params.set('hasSellerComments', 'true');
  }

  if (filters.hasOptions) {
    params.set('hasOptions', 'true');
  }

  if (filters.stockNumber) {
    params.set('stockNumber', filters.stockNumber);
  }

  if (filters.vin) {
    params.set('vin', filters.vin);
  }

  return params;
}

/**
 * Count active filters
 */
export function countActiveFilters(filters: InventoryFilters): number {
  let count = 0;

  if (filters.condition.length > 0) count++;
  if (filters.bodyType.length > 0) count++;
  if (filters.minPrice !== null) count++;
  if (filters.maxPrice !== null) count++;
  if (filters.minMsrp !== null) count++;
  if (filters.maxMsrp !== null) count++;
  if (filters.daysOnLot !== 'any') count++;
  if (filters.hasPhotos) count++;
  if (filters.hasSellerComments) count++;
  if (filters.hasOptions) count++;
  if (filters.stockNumber) count++;
  if (filters.vin) count++;

  return count;
}

