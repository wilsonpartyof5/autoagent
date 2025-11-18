# MarketCheck Sync Screenshots

This directory contains screenshots from MarketCheck sync testing.

## Expected Screenshots

### 1. Setup Page with Rooftop Detection
**File**: `setup-rooftop-detection-2025-11-07.png`
**Description**: 
- Shows `/app/setup` page
- Dealer ID `10015450` entered
- Rooftop auto-detected: "Ask Jorge Lopez - 22702 Tomball Parkway, Tomball, TX 77375"
- ZIP auto-populated: `77375`
- No error banners visible

### 2. Sync Success Message
**File**: `sync-success-2025-11-07.png`
**Description**:
- Green success toast/banner
- Message: "Inventory synced from MarketCheck. Imported 3 vehicles."

### 3. Inventory Page with Vehicles
**File**: `inventory-vehicles-2025-11-07.png`
**Description**:
- Shows `/app/inventory` page
- 3 vehicle cards displayed in grid layout
- All vehicles visible (2026 Ford F-250 Super Duty Platinum)
- Vehicle details visible (VINs, mileage, condition badges)

## How to Capture Screenshots

1. **Setup Page**:
   - Navigate to `http://localhost:3000/app/setup`
   - Enter dealer ID: `10015450`
   - Wait for rooftop to auto-detect
   - Take screenshot

2. **Success Message**:
   - After clicking "Sync Inventory"
   - Wait for success message to appear
   - Take screenshot

3. **Inventory Page**:
   - Navigate to `http://localhost:3000/app/inventory`
   - Wait for vehicles to load
   - Take screenshot showing all 3 vehicles

## Notes

- Screenshots should be PNG format
- Include date in filename (YYYY-MM-DD)
- Capture full page or relevant section
- Ensure text is readable

