import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

/**
 * Initialize SQLite database for dashboard
 */
function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'dashboard.db');
  db = new Database(dbPath);

  // Create leads table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      dealerId TEXT,
      vehicleId TEXT,
      vin TEXT,
      encPayload TEXT,
      createdAt INTEGER
    )
  `);

  return db;
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
