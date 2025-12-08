import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

/**
 * Initialize SQLite database
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

  const dbPath = path.join(dataDir, 'autoagent.db');
  db = new Database(dbPath);

  // Create leads table (UVS-first schema)
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      uvs_vehicle_id TEXT NOT NULL,
      uvs_dealer_id TEXT,
      vehicleId TEXT NOT NULL,
      dealerId TEXT,
      vin TEXT NOT NULL,
      price NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      encPayload TEXT NOT NULL,
      consent INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      ipAddress TEXT
    )
  `);

  // Add VIN column if it doesn't exist (for existing databases)
  try {
    db.exec('ALTER TABLE leads ADD COLUMN vin TEXT');
  } catch {
    // Column already exists, ignore error
  }

  // Add IP address column if it doesn't exist
  try {
    db.exec('ALTER TABLE leads ADD COLUMN ipAddress TEXT');
  } catch {
    // Column already exists, ignore error
  }

  // Add UVS FK columns if they don't exist (for existing databases)
  try {
    db.exec('ALTER TABLE leads ADD COLUMN uvs_vehicle_id TEXT');
  } catch {
    // Column already exists, ignore error
  }

  try {
    db.exec('ALTER TABLE leads ADD COLUMN uvs_dealer_id TEXT');
  } catch {
    // Column already exists, ignore error
  }

  // Add pricing columns if they don't exist
  try {
    db.exec('ALTER TABLE leads ADD COLUMN price NUMERIC');
  } catch {
    // Column already exists, ignore error
  }

  try {
    db.exec('ALTER TABLE leads ADD COLUMN currency TEXT DEFAULT "USD"');
  } catch {
    // Column already exists, ignore error
  }

  return db;
}

/**
 * Insert a new lead (UVS-first)
 */
export function insertLead({
  id,
  uvsVehicleId,
  uvsDealerId,
  dealerId,
  vehicleId,
  vin,
  price,
  currency,
  encPayload,
  consent,
  createdAt,
  ipAddress,
}: {
  id: string;
  uvsVehicleId: string; // FK to uvs_vehicles.id
  uvsDealerId?: string; // FK to uvs_vehicles.dealer_id
  dealerId?: string; // Keep for backward compatibility
  vehicleId: string;
  vin: string;
  price: number;
  currency: string;
  encPayload: string;
  consent: boolean;
  createdAt: number;
  ipAddress?: string;
}): void {
  const database = getDatabase();
  
  const stmt = database.prepare(`
    INSERT INTO leads (
      id, uvs_vehicle_id, uvs_dealer_id, dealerId, vehicleId, vin, 
      price, currency, encPayload, consent, createdAt, ipAddress
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    uvsVehicleId,
    uvsDealerId || null,
    dealerId || null,
    vehicleId,
    vin,
    price,
    currency,
    encPayload,
    consent ? 1 : 0,
    createdAt,
    ipAddress || null
  );
}

/**
 * Count recent leads by IP address within a time window
 */
export function countRecentLeadsByIp(ipAddress: string, windowMs: number): number {
  const database = getDatabase();
  
  const stmt = database.prepare(`
    SELECT COUNT(*) as count
    FROM leads
    WHERE ipAddress = ? AND createdAt > ?
  `);
  
  const cutoffTime = Date.now() - windowMs;
  const result = stmt.get(ipAddress, cutoffTime) as { count: number };
  
  return result.count;
}

/**
 * Get all leads (for testing/admin purposes)
 */
export function getAllLeads(): Array<{
  id: string;
  dealerId?: string;
  vehicleId: string;
  vin?: string;
  encPayload: string;
  consent: boolean;
  createdAt: number;
  ipAddress?: string;
}> {
  const database = getDatabase();
  
  const stmt = database.prepare(`
    SELECT id, dealerId, vehicleId, vin, encPayload, consent, createdAt, ipAddress
    FROM leads
    ORDER BY createdAt DESC
  `);
  
  return stmt.all() as Array<{
    id: string;
    dealerId?: string;
    vehicleId: string;
    vin?: string;
    encPayload: string;
    consent: boolean;
    createdAt: number;
    ipAddress?: string;
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
