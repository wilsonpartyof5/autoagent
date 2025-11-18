/**
 * Execute database migrations via Supabase client
 * Requires SUPABASE_SERVICE_ROLE_KEY for elevated permissions
 */

const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", "apps", "mcp-server", ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ Supabase URL not found");
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found");
  console.log("\n💡 To run migrations programmatically, add SUPABASE_SERVICE_ROLE_KEY to .env.local");
  console.log("   Otherwise, run migrations manually in Supabase SQL Editor:\n");
  console.log("   1. Open Supabase Dashboard → SQL Editor");
  console.log("   2. Copy contents of: scripts/run-all-migrations.sql");
  console.log("   3. Paste and execute in SQL Editor");
  console.log("   4. Verify with: node scripts/checkDatabaseSchema.js\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeMigrations() {
  console.log("=".repeat(60));
  console.log("Executing Database Migrations");
  console.log("=".repeat(60));
  console.log("");

  const migrationFile = path.join(__dirname, "run-all-migrations.sql");
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log("📄 Reading migration file: run-all-migrations.sql");
  console.log(`   File size: ${sql.length} characters\n`);

  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📊 Found ${statements.length} SQL statements\n`);

  console.log("⚠️  Supabase JS client doesn't support executing raw SQL directly");
  console.log("   Migrations must be run in Supabase SQL Editor\n");
  console.log("💡 Instructions:");
  console.log("   1. Open Supabase Dashboard → SQL Editor");
  console.log("   2. Copy the contents of: scripts/run-all-migrations.sql");
  console.log("   3. Paste into SQL Editor and click 'Run'");
  console.log("   4. Verify with: node scripts/checkDatabaseSchema.js\n");

  // Alternatively, we could use the REST API, but it's more complex
  console.log("📋 Migration SQL preview (first 500 chars):");
  console.log(sql.substring(0, 500) + "...\n");
}

executeMigrations().catch(console.error);

