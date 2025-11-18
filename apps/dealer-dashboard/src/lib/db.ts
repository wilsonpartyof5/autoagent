// Stub implementation for Vercel deployment (better-sqlite3 not available in serverless)
// TODO: Replace with Supabase-based implementation

let db: any = null;

/**
 * Initialize SQLite database for dashboard
 * Stubbed for Vercel deployment
 */
function getDatabase(): any {
  if (db) {
    return db;
  }
  
  // Return a stub object that matches the expected interface
  return {
    prepare: () => ({
      run: () => {},
      all: () => [],
    }),
    exec: () => {},
    close: () => {},
  };
}

/**
 * Upsert a lead (insert or update)
 */
export function upsertLead({
  id,
  dealerId,
  vehicleId,
  vin,
  encPayload,
  createdAt,
}: {
  id: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  encPayload: string;
  createdAt: number;
}): void {
  const database = getDatabase();
  
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO leads (id, dealerId, vehicleId, vin, encPayload, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, dealerId, vehicleId, vin, encPayload, createdAt);
}

/**
 * Get recent leads
 */
export function getRecentLeads(limit: number = 100): Array<{
  id: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  encPayload: string;
  createdAt: number;
}> {
  const database = getDatabase();
  
  const stmt = database.prepare(`
    SELECT id, dealerId, vehicleId, vin, encPayload, createdAt
    FROM leads
    ORDER BY createdAt DESC
    LIMIT ?
  `);
  
  return stmt.all(limit) as Array<{
    id: string;
    dealerId?: string;
    vehicleId: string;
    vin?: string;
    encPayload: string;
    createdAt: number;
  }>;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
