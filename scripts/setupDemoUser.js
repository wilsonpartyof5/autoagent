/**
 * Setup demo user profile and seed inventory
 * Gets user ID and ensures profile is configured with MarketCheck dealer ID
 */

const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, "..", "apps", "dealer-dashboard", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL not found");
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local");
  console.error("   Add it to apps/dealer-dashboard/.env.local to run this script");
  console.error("   Or run the SQL manually in Supabase SQL Editor");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupDemoUser() {
  console.log("🔍 Finding or creating demo user profile...\n");

  // Get first user from auth.users
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  
  if (userError || !users || users.users.length === 0) {
    console.error("❌ No users found. Please:");
    console.error("   1. Sign in to http://localhost:3000/auth");
    console.error("   2. Create an account");
    console.error("   3. Run this script again");
    return;
  }

  const user = users.users[0];
  const userId = user.id;
  console.log(`✅ Found user: ${user.email} (${userId})\n`);

  // Ensure profile exists and is configured
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error("❌ Error checking profile:", profileError);
    return;
  }

  // Upsert profile with MarketCheck settings
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: user.email,
      marketcheck_dealer_id: '10015450',
      marketcheck_zip: '77375',
      dms_provider: 'marketcheck',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'
    });

  if (upsertError) {
    console.error("❌ Error updating profile:", upsertError);
    return;
  }

  console.log("✅ Profile configured:");
  console.log(`   MarketCheck Dealer ID: 10015450`);
  console.log(`   ZIP: 77375\n`);

  // Now seed inventory
  console.log("🌱 Seeding inventory...\n");

  const demoVehicles = [
    {
      user_id: userId,
      vin: "1HGBH41JXMN109186", year: 2022, make: "Toyota", model: "Camry", trim: "LE",
      condition: "used", body_type: "Sedan", price: 28500, msrp: 32000, miles: 15000,
      stock_number: "STK-001", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Midnight Black", interior_color: "Charcoal", drivetrain: "FWD",
      fuel_type: "Gasoline", transmission: "Automatic", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "5YJSA1E26HF123456", year: 2023, make: "Tesla", model: "Model 3", trim: "Long Range",
      condition: "new", body_type: "Sedan", price: 48990, msrp: 48990, miles: 5,
      stock_number: "STK-002", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Pearl White", interior_color: "Black", drivetrain: "AWD",
      fuel_type: "Electric", transmission: "Automatic", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "1C4RJFBG3FC123789", year: 2021, make: "Jeep", model: "Grand Cherokee", trim: "Limited",
      condition: "used", body_type: "SUV", price: 38900, msrp: 45000, miles: 28000,
      stock_number: "STK-003", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Granite Crystal", interior_color: "Black", drivetrain: "4WD",
      fuel_type: "Gasoline", transmission: "Automatic", certified: true,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "1FT8W2BT7TED28933", year: 2024, make: "Ford", model: "F-150", trim: "XLT",
      condition: "new", body_type: "Pickup", price: 45900, msrp: 45900, miles: 0,
      stock_number: "STK-004", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Oxford White", interior_color: "Ebony", drivetrain: "4WD",
      fuel_type: "Gasoline", transmission: "Automatic", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "WBA3A5C58EF123456", year: 2020, make: "BMW", model: "X5", trim: "xDrive40i",
      condition: "used", body_type: "SUV", price: 42900, msrp: 61000, miles: 35000,
      stock_number: "STK-005", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Mineral White", interior_color: "Black Vernasca Leather", drivetrain: "AWD",
      fuel_type: "Gasoline", transmission: "Automatic", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "5TDDKRFH8LS123456", year: 2023, make: "Honda", model: "CR-V", trim: "EX-L",
      condition: "new", body_type: "SUV", price: 32900, msrp: 32900, miles: 10,
      stock_number: "STK-006", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Radiant Red", interior_color: "Black", drivetrain: "FWD",
      fuel_type: "Gasoline", transmission: "CVT", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "1G1BE5SM8K7123456", year: 2019, make: "Chevrolet", model: "Corvette", trim: "Stingray",
      condition: "used", body_type: "Coupe", price: 59900, msrp: 59995, miles: 12000,
      stock_number: "STK-007", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Arctic White", interior_color: "Jet Black", drivetrain: "RWD",
      fuel_type: "Gasoline", transmission: "Manual", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "JTMB1RFV8KD123456", year: 2023, make: "Toyota", model: "RAV4", trim: "XLE Premium",
      condition: "new", body_type: "SUV", price: 36900, msrp: 36900, miles: 8,
      stock_number: "STK-008", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Lunar Rock", interior_color: "Softex Black", drivetrain: "AWD",
      fuel_type: "Hybrid", transmission: "CVT", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "1FA6P8TH5L5123456", year: 2020, make: "Ford", model: "Mustang", trim: "GT Premium",
      condition: "used", body_type: "Coupe", price: 38900, msrp: 45000, miles: 18000,
      stock_number: "STK-009", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Velocity Blue", interior_color: "Ebony", drivetrain: "RWD",
      fuel_type: "Gasoline", transmission: "Manual", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      vin: "5YJ3E1EB5KF123456", year: 2019, make: "Tesla", model: "Model Y", trim: "Long Range",
      condition: "used", body_type: "SUV", price: 42900, msrp: 52000, miles: 25000,
      stock_number: "STK-010", dealer_name: "Ask Jorge Lopez", dealer_city: "Tomball",
      dealer_state: "TX", dealer_zip: "77375", dealer_id: "10015450",
      dealer_address: "123 Main St, Tomball, TX 77375", dealer_phone: "281-555-1234",
      exterior_color: "Midnight Silver Metallic", interior_color: "Black", drivetrain: "AWD",
      fuel_type: "Electric", transmission: "Automatic", certified: false,
      data_source: "seed-demo", sync_status: "success", lead_status: "none",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    },
  ];

  // Delete existing seed-demo vehicles
  const { error: deleteError } = await supabase
    .from('inventory_vehicles')
    .delete()
    .eq('user_id', userId)
    .eq('data_source', 'seed-demo');

  if (deleteError) {
    console.error("⚠️  Error deleting existing vehicles:", deleteError.message);
  }

  // Insert vehicles
  const { data, error } = await supabase
    .from('inventory_vehicles')
    .insert(demoVehicles)
    .select('id, vin, year, make, model');

  if (error) {
    console.error("❌ Error inserting vehicles:", error);
    console.error("\nRun this SQL in Supabase SQL Editor instead:\n");
    console.log(generateSQL(userId));
    return;
  }

  console.log(`✅ Successfully inserted ${data.length} vehicles:\n`);
  data.forEach((v, i) => {
    console.log(`${i + 1}. ${v.year} ${v.make} ${v.model} (VIN: ${v.vin})`);
  });

  // Verify count
  const { count } = await supabase
    .from('inventory_vehicles')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('data_source', 'seed-demo');

  console.log(`\n📊 Total seed-demo vehicles: ${count}`);
  console.log(`\n✅ Setup complete! User ${userId} is ready for demo.\n`);
  console.log("SQL used (for documentation):\n");
  console.log(generateSQL(userId));
}

function generateSQL(userId) {
  return `-- Seed demo inventory for user ${userId}
-- Run in Supabase SQL Editor

DELETE FROM inventory_vehicles WHERE user_id = '${userId}' AND data_source = 'seed-demo';

INSERT INTO inventory_vehicles (
  user_id, vin, year, make, model, trim, condition, body_type, price, msrp, miles,
  stock_number, dealer_name, dealer_city, dealer_state, dealer_zip, dealer_id,
  dealer_address, dealer_phone, exterior_color, interior_color, drivetrain,
  fuel_type, transmission, certified, data_source, sync_status, lead_status,
  created_at, updated_at, last_synced_at
) VALUES
('${userId}', '1HGBH41JXMN109186', 2022, 'Toyota', 'Camry', 'LE', 'used', 'Sedan', 28500, 32000, 15000, 'STK-001', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Midnight Black', 'Charcoal', 'FWD', 'Gasoline', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', '5YJSA1E26HF123456', 2023, 'Tesla', 'Model 3', 'Long Range', 'new', 'Sedan', 48990, 48990, 5, 'STK-002', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Pearl White', 'Black', 'AWD', 'Electric', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', '1C4RJFBG3FC123789', 2021, 'Jeep', 'Grand Cherokee', 'Limited', 'used', 'SUV', 38900, 45000, 28000, 'STK-003', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Granite Crystal', 'Black', '4WD', 'Gasoline', 'Automatic', true, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', '1FT8W2BT7TED28933', 2024, 'Ford', 'F-150', 'XLT', 'new', 'Pickup', 45900, 45900, 0, 'STK-004', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Oxford White', 'Ebony', '4WD', 'Gasoline', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', 'WBA3A5C58EF123456', 2020, 'BMW', 'X5', 'xDrive40i', 'used', 'SUV', 42900, 61000, 35000, 'STK-005', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Mineral White', 'Black Vernasca Leather', 'AWD', 'Gasoline', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', '5TDDKRFH8LS123456', 2023, 'Honda', 'CR-V', 'EX-L', 'new', 'SUV', 32900, 32900, 10, 'STK-006', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Radiant Red', 'Black', 'FWD', 'Gasoline', 'CVT', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', '1G1BE5SM8K7123456', 2019, 'Chevrolet', 'Corvette', 'Stingray', 'used', 'Coupe', 59900, 59995, 12000, 'STK-007', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Arctic White', 'Jet Black', 'RWD', 'Gasoline', 'Manual', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', 'JTMB1RFV8KD123456', 2023, 'Toyota', 'RAV4', 'XLE Premium', 'new', 'SUV', 36900, 36900, 8, 'STK-008', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Lunar Rock', 'Softex Black', 'AWD', 'Hybrid', 'CVT', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', '1FA6P8TH5L5123456', 2020, 'Ford', 'Mustang', 'GT Premium', 'used', 'Coupe', 38900, 45000, 18000, 'STK-009', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Velocity Blue', 'Ebony', 'RWD', 'Gasoline', 'Manual', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW()),
('${userId}', '5YJ3E1EB5KF123456', 2019, 'Tesla', 'Model Y', 'Long Range', 'used', 'SUV', 42900, 52000, 25000, 'STK-010', 'Ask Jorge Lopez', 'Tomball', 'TX', '77375', '10015450', '123 Main St, Tomball, TX 77375', '281-555-1234', 'Midnight Silver Metallic', 'Black', 'AWD', 'Electric', 'Automatic', false, 'seed-demo', 'success', 'none', NOW(), NOW(), NOW());

SELECT COUNT(*) as vehicle_count FROM inventory_vehicles WHERE user_id = '${userId}' AND data_source = 'seed-demo';`;
}

setupDemoUser().catch(console.error);

