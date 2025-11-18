/**
 * Seed demo inventory for testing
 * Inserts 10 realistic vehicles into inventory_vehicles for the current test user
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL not found");
  process.exit(1);
}

// Use service role key if available, otherwise anon key
const supabaseKey = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
if (!supabaseKey) {
  console.error("❌ Supabase key not found (need SERVICE_ROLE_KEY or ANON_KEY)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, supabaseKey);

// Demo vehicles with realistic data
const demoVehicles = [
  {
    vin: "1HGBH41JXMN109186",
    year: 2022,
    make: "Toyota",
    model: "Camry",
    trim: "LE",
    condition: "used",
    body_type: "Sedan",
    price: 28500,
    msrp: 32000,
    miles: 15000,
    stock_number: "STK-001",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Midnight Black",
    interior_color: "Charcoal",
    drivetrain: "FWD",
    fuel_type: "Gasoline",
    transmission: "Automatic",
    certified: false,
    data_source: "seed-demo",
  },
  {
    vin: "5YJSA1E26HF123456",
    year: 2023,
    make: "Tesla",
    model: "Model 3",
    trim: "Long Range",
    condition: "new",
    body_type: "Sedan",
    price: 48990,
    msrp: 48990,
    miles: 5,
    stock_number: "STK-002",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Pearl White",
    interior_color: "Black",
    drivetrain: "AWD",
    fuel_type: "Electric",
    transmission: "Automatic",
    certified: false,
    data_source: "seed-demo",
  },
  {
    vin: "1C4RJFBG3FC123789",
    year: 2021,
    make: "Jeep",
    model: "Grand Cherokee",
    trim: "Limited",
    condition: "used",
    body_type: "SUV",
    price: 38900,
    msrp: 45000,
    miles: 28000,
    stock_number: "STK-003",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Granite Crystal",
    interior_color: "Black",
    drivetrain: "4WD",
    fuel_type: "Gasoline",
    transmission: "Automatic",
    certified: true,
    data_source: "seed-demo",
  },
  {
    vin: "1FT8W2BT7TED28933",
    year: 2024,
    make: "Ford",
    model: "F-150",
    trim: "XLT",
    condition: "new",
    body_type: "Pickup",
    price: 45900,
    msrp: 45900,
    miles: 0,
    stock_number: "STK-004",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Oxford White",
    interior_color: "Ebony",
    drivetrain: "4WD",
    fuel_type: "Gasoline",
    transmission: "Automatic",
    certified: false,
    data_source: "seed-demo",
  },
  {
    vin: "WBA3A5C58EF123456",
    year: 2020,
    make: "BMW",
    model: "X5",
    trim: "xDrive40i",
    condition: "used",
    body_type: "SUV",
    price: 42900,
    msrp: 61000,
    miles: 35000,
    stock_number: "STK-005",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Mineral White",
    interior_color: "Black Vernasca Leather",
    drivetrain: "AWD",
    fuel_type: "Gasoline",
    transmission: "Automatic",
    certified: false,
    data_source: "seed-demo",
  },
  {
    vin: "5TDDKRFH8LS123456",
    year: 2023,
    make: "Honda",
    model: "CR-V",
    trim: "EX-L",
    condition: "new",
    body_type: "SUV",
    price: 32900,
    msrp: 32900,
    miles: 10,
    stock_number: "STK-006",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Radiant Red",
    interior_color: "Black",
    drivetrain: "FWD",
    fuel_type: "Gasoline",
    transmission: "CVT",
    certified: false,
    data_source: "seed-demo",
  },
  {
    vin: "1G1BE5SM8K7123456",
    year: 2019,
    make: "Chevrolet",
    model: "Corvette",
    trim: "Stingray",
    condition: "used",
    body_type: "Coupe",
    price: 59900,
    msrp: 59995,
    miles: 12000,
    stock_number: "STK-007",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Arctic White",
    interior_color: "Jet Black",
    drivetrain: "RWD",
    fuel_type: "Gasoline",
    transmission: "Manual",
    certified: false,
    data_source: "seed-demo",
  },
  {
    vin: "JTMB1RFV8KD123456",
    year: 2023,
    make: "Toyota",
    model: "RAV4",
    trim: "XLE Premium",
    condition: "new",
    body_type: "SUV",
    price: 36900,
    msrp: 36900,
    miles: 8,
    stock_number: "STK-008",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Lunar Rock",
    interior_color: "Softex Black",
    drivetrain: "AWD",
    fuel_type: "Hybrid",
    transmission: "CVT",
    certified: false,
    data_source: "seed-demo",
  },
  {
    vin: "1FA6P8TH5L5123456",
    year: 2020,
    make: "Ford",
    model: "Mustang",
    trim: "GT Premium",
    condition: "used",
    body_type: "Coupe",
    price: 38900,
    msrp: 45000,
    miles: 18000,
    stock_number: "STK-009",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Velocity Blue",
    interior_color: "Ebony",
    drivetrain: "RWD",
    fuel_type: "Gasoline",
    transmission: "Manual",
    certified: false,
    data_source: "seed-demo",
  },
  {
    vin: "5YJ3E1EB5KF123456",
    year: 2019,
    make: "Tesla",
    model: "Model Y",
    trim: "Long Range",
    condition: "used",
    body_type: "SUV",
    price: 42900,
    msrp: 52000,
    miles: 25000,
    stock_number: "STK-010",
    dealer_name: "Ask Jorge Lopez",
    dealer_city: "Tomball",
    dealer_state: "TX",
    dealer_zip: "77375",
    dealer_id: "10015450",
    dealer_address: "123 Main St, Tomball, TX 77375",
    dealer_phone: "281-555-1234",
    exterior_color: "Midnight Silver Metallic",
    interior_color: "Black",
    drivetrain: "AWD",
    fuel_type: "Electric",
    transmission: "Automatic",
    certified: false,
    data_source: "seed-demo",
  },
];

async function seedInventory() {
  console.log("🌱 Seeding demo inventory...\n");

  // First, try to get a user ID from profiles
  // If using service role key, we can query directly
  // Otherwise, we'll need to create a test user or use SQL editor

  let userId = null;

  if (SUPABASE_SERVICE_KEY) {
    // Query for existing users
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!userError && users) {
      userId = users.id;
      console.log(`✅ Found existing user: ${userId}`);
    } else {
      console.log("⚠️  No existing user found. You'll need to:");
      console.log("   1. Sign in to the dashboard at http://localhost:3000/auth");
      console.log("   2. Run this script again, or");
      console.log("   3. Use Supabase SQL Editor to insert vehicles with your user_id");
      console.log("\nSQL to run in Supabase SQL Editor:\n");
      generateSQL();
      return;
    }
  } else {
    console.log("⚠️  Using ANON_KEY - cannot query profiles directly");
    console.log("Please run this SQL in Supabase SQL Editor with your user_id:\n");
    generateSQL();
    return;
  }

  if (!userId) {
    console.error("❌ Could not determine user_id");
    return;
  }

  // Delete existing seed-demo vehicles for this user
  const { error: deleteError } = await supabase
    .from('inventory_vehicles')
    .delete()
    .eq('user_id', userId)
    .eq('data_source', 'seed-demo');

  if (deleteError) {
    console.error("⚠️  Error deleting existing seed vehicles:", deleteError.message);
  } else {
    console.log("🧹 Cleaned up existing seed-demo vehicles\n");
  }

  // Insert vehicles
  const vehiclesToInsert = demoVehicles.map(vehicle => ({
    ...vehicle,
    user_id: userId,
    sync_status: 'success',
    lead_status: 'none',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('inventory_vehicles')
    .insert(vehiclesToInsert)
    .select('id, vin, year, make, model');

  if (error) {
    console.error("❌ Error inserting vehicles:", error);
    console.log("\n📋 Alternative: Run this SQL in Supabase SQL Editor:\n");
    generateSQL(userId);
    return;
  }

  console.log(`✅ Successfully inserted ${data.length} vehicles:\n`);
  data.forEach((v, i) => {
    console.log(`${i + 1}. ${v.year} ${v.make} ${v.model} (VIN: ${v.vin})`);
  });

  console.log(`\n📊 Total vehicles for user ${userId}: ${data.length}`);
  console.log("\nSQL used (for documentation):\n");
  generateSQL(userId);
}

function generateSQL(userId = 'YOUR_USER_ID_HERE') {
  const sql = `-- Seed demo inventory (10 vehicles)
-- Replace YOUR_USER_ID_HERE with your actual user_id from auth.users

INSERT INTO inventory_vehicles (
  user_id, vin, year, make, model, trim, condition, body_type, price, msrp, miles,
  stock_number, dealer_name, dealer_city, dealer_state, dealer_zip, dealer_id,
  dealer_address, dealer_phone, exterior_color, interior_color, drivetrain,
  fuel_type, transmission, certified, data_source, sync_status, lead_status,
  created_at, updated_at, last_synced_at
) VALUES
${demoVehicles.map((v, i) => {
  const values = [
    `'${userId}'`,
    `'${v.vin}'`,
    v.year,
    `'${v.make}'`,
    `'${v.model}'`,
    `'${v.trim}'`,
    `'${v.condition}'`,
    `'${v.body_type}'`,
    v.price,
    v.msrp,
    v.miles,
    `'${v.stock_number}'`,
    `'${v.dealer_name}'`,
    `'${v.dealer_city}'`,
    `'${v.dealer_state}'`,
    `'${v.dealer_zip}'`,
    `'${v.dealer_id}'`,
    `'${v.dealer_address}'`,
    `'${v.dealer_phone}'`,
    `'${v.exterior_color}'`,
    `'${v.interior_color}'`,
    `'${v.drivetrain}'`,
    `'${v.fuel_type}'`,
    `'${v.transmission}'`,
    v.certified,
    `'seed-demo'`,
    `'success'`,
    `'none'`,
    `NOW()`,
    `NOW()`,
    `NOW()`
  ].join(', ');
  return `(${values})${i < demoVehicles.length - 1 ? ',' : ';'}`;
}).join('\n')}

-- Verify insertion
SELECT COUNT(*) as vehicle_count FROM inventory_vehicles WHERE user_id = '${userId}' AND data_source = 'seed-demo';`;

  console.log(sql);
}

seedInventory().catch(console.error);

