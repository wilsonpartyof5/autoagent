# Vehicle Detail Modal - Information Analysis

## Goal
Ensure the vehicle detail modal contains enough information for ChatGPT API to answer user queries about vehicles.

---

## 📊 Currently Stored in Database (UVS Schema)

### ✅ **Base Identity** (Stored)
- VIN
- Year, Make, Model, Trim
- Stock Number
- Listing ID
- Vehicle Type (car/truck/suv/van/etc.)

### ✅ **Core Specs** (Stored)
- Body Type
- Fuel Type (gasoline/diesel/electric/hybrid/etc.)
- Engine:
  - Description (e.g., "6.2L V8")
  - Displacement (parsed from description)
  - Cylinders (parsed from description)
  - Horsepower (parsed from description)
  - ⚠️ **Missing**: Torque, Aspiration (turbocharged/supercharged)
- Transmission:
  - Type (automatic/manual/CVT/etc.)
  - Description
  - ⚠️ **Missing**: Number of speeds
- Drivetrain (FWD/RWD/AWD/4WD)
- Odometer (miles/kilometers)

### ⚠️ **Dimensions & Performance** (Schema exists, but NOT populated from MarketCheck)
- Length, Width, Height, Wheelbase
- Ground Clearance
- Curb Weight
- Towing Capacity
- Payload Capacity
- **Fuel Economy** (City/Highway/Combined MPG) - **CRITICAL FOR CHATGPT**
- Acceleration (0-60, 0-100)
- Top Speed

### ✅ **Pricing** (Stored)
- Price
- MSRP
- Price Change History
- Currency

### ✅ **Features & Packages** (Stored)
- Features (array of strings)
- Packages (name, code, description, price)
- Interior Color
- Exterior Color
- Certified status

### ⚠️ **Warranty** (Schema exists, but NOT populated)
- Type (manufacturer/extended/dealer)
- Months
- Miles
- Description

### ✅ **Media** (Stored)
- Primary Photo URL
- Photo URLs (array)
- Video URL (if available)

### ✅ **Dealer Info** (Stored)
- Dealer ID, Name
- City, State
- Address (constructed from street/city/state/zip)
- Phone
- Website
- Latitude/Longitude

### ✅ **Market Data** (Stored)
- Average Days on Market
- Market Average Price (if available)

### ✅ **History** (Schema exists, but NOT populated)
- Accident History
- Service Records
- Ownership Count
- Title Status

---

## 📺 Currently Displayed in Detail Modal

### ✅ **Displayed Sections:**
1. **Header**: Year, Make, Model, Trim, Condition, Body Type
2. **Live Status Banner**: Published/Not Published toggle
3. **Analytics** (if live): Views, Clicks, Leads, Avg Time
4. **Image Gallery**: Primary photo + thumbnails
5. **Key Specifications**:
   - VIN
   - Stock Number
   - Price
   - MSRP
   - Mileage
   - Days on Market
6. **Detailed Specifications**:
   - Drivetrain
   - Fuel Type
   - Transmission
   - Interior Color
   - Exterior Color
   - Certified
7. **Features & Options**: Features list + Options with descriptions
8. **Seller Comments**: From enrichment data
9. **Market Data**: Market Average Price vs Your Price
10. **Dealer Information**: Name, Address, City/State, Phone, Website

### ⚠️ **NOT Displayed (but stored):**
- Engine details (displacement, cylinders, horsepower) - **SHOULD DISPLAY**
- Transmission speeds
- Price change history
- Video URL
- Dealer coordinates (lat/lng)

### ❌ **NOT Stored or Displayed:**
- Engine torque
- Engine aspiration (turbo/supercharged)
- Fuel economy (MPG) - **CRITICAL MISSING**
- Dimensions (length, width, height, wheelbase)
- Weight
- Towing capacity
- Seating capacity
- Number of doors
- Warranty information
- Vehicle history (accidents, service records)
- Acceleration specs
- Top speed

---

## 🔍 What MarketCheck API Provides

Based on `MarketCheckVehicle` interface and documentation:

### ✅ **Available from MarketCheck:**
- `id`, `vin`, `stock_no`, `heading`
- `price`, `msrp`, `dom` (days on market)
- `mileage` / `miles`
- `inventory_type` (new/used/cpo)
- `certified` (boolean)
- `exterior_color`, `interior_color`
- `features` (string array)
- `price_history` (array)
- `market_data.market_average_price`
- `dealer.*` (name, address, city, state, zip, phone, website, lat/lng)
- `build.*`:
  - `year`, `make`, `model`, `trim`
  - `body_type`
  - `drivetrain` / `drive_train`
  - `fuel_type`
  - `transmission`
  - ⚠️ **Missing**: `engine` object (only description string)

### ⚠️ **Enrichment Data (via separate API calls):**
- `extra.specifications` - May contain additional specs
- `extra.options` - Detailed options with codes/descriptions/prices
- `extra.seller_comments` - Dealer comments
- `extra.warranty` - Warranty information (if available)

### ❌ **NOT Available from MarketCheck:**
- Engine torque
- Engine aspiration details
- Fuel economy (MPG) - **MAJOR GAP**
- Dimensions (length, width, height, wheelbase)
- Weight
- Towing capacity
- Seating capacity
- Number of doors
- Acceleration specs
- Top speed
- Vehicle history (accidents, service records)

---

## 💬 Common ChatGPT User Queries

### **Price & Value Queries:**
- ✅ "What's the price of this vehicle?"
- ✅ "How does this compare to market average?"
- ✅ "Has the price changed recently?" (price history stored but not displayed)

### **Specification Queries:**
- ✅ "What's the engine size?" (stored but not displayed)
- ⚠️ "What's the horsepower?" (stored but not displayed)
- ❌ "What's the torque?" (not stored)
- ❌ "Is it turbocharged?" (not stored)
- ✅ "What's the transmission?" (displayed)
- ⚠️ "How many speeds?" (not stored)
- ❌ "What's the fuel economy?" (not stored) - **CRITICAL MISSING**
- ✅ "What's the drivetrain?" (displayed)
- ❌ "How many seats?" (not stored)
- ❌ "How many doors?" (not stored)

### **Size & Capacity Queries:**
- ❌ "What are the dimensions?" (not stored)
- ❌ "What's the towing capacity?" (not stored)
- ❌ "What's the payload capacity?" (not stored)
- ❌ "How much does it weigh?" (not stored)

### **Feature Queries:**
- ✅ "What features does it have?" (displayed)
- ✅ "What options are included?" (displayed)
- ✅ "What color is it?" (displayed)

### **History & Condition Queries:**
- ✅ "How many miles?" (displayed)
- ✅ "Is it certified?" (displayed)
- ✅ "How long has it been on the lot?" (displayed)
- ❌ "Has it been in an accident?" (not stored)
- ❌ "What's the service history?" (not stored)

### **Warranty Queries:**
- ❌ "What warranty does it have?" (not stored)

### **Performance Queries:**
- ❌ "What's the 0-60 time?" (not stored)
- ❌ "What's the top speed?" (not stored)

---

## 🎯 Recommendations

### **Priority 1: Display Existing Data**
1. **Add Engine Details Section**:
   - Display displacement, cylinders, horsepower (already stored in `coreSpecs.engine`)
   - Show transmission speeds if available

2. **Add Price History**:
   - Show price change history timeline (already stored in `pricing.priceChangeHistory`)

3. **Add Video**:
   - Display video player if `media.videoUrl` exists

### **Priority 2: Extract from Enrichment Data**
1. **Check `extra.specifications`**:
   - May contain fuel economy, dimensions, seating, doors
   - Parse and display if available

2. **Check `extra.warranty`**:
   - Display warranty information if available

### **Priority 3: Add Missing Critical Fields**
1. **Fuel Economy (MPG)**:
   - **CRITICAL**: This is a very common query
   - Options:
     - Check if MarketCheck enrichment provides it
     - Use third-party API (EPA, FuelEconomy.gov)
     - Calculate from make/model/year/trim if needed

2. **Seating Capacity & Doors**:
   - Common queries for families
   - May be in enrichment data or can be derived from make/model/year

3. **Dimensions**:
   - Less critical but useful for "Will it fit in my garage?" queries
   - May be in enrichment data

### **Priority 4: Nice-to-Have**
1. **Towing Capacity** (for trucks/SUVs)
2. **Weight** (for shipping/towing calculations)
3. **Acceleration Specs** (for performance queries)
4. **Vehicle History** (if available from other sources)

---

## 📝 Action Items

### **Immediate (Display Existing Data):**
- [ ] Add "Engine Specifications" section to detail modal
- [ ] Add "Price History" section to detail modal
- [ ] Add video player if video URL exists
- [ ] Display transmission speeds if available

### **Short-term (Extract from Enrichment):**
- [ ] Parse `extra.specifications` for fuel economy, dimensions, seating, doors
- [ ] Display warranty information from `extra.warranty`
- [ ] Check if MarketCheck enrichment API provides additional fields

### **Medium-term (Add Missing Data):**
- [ ] Research if MarketCheck provides fuel economy data
- [ ] Integrate EPA API or FuelEconomy.gov for MPG data
- [ ] Add seating capacity and doors (from enrichment or derived)
- [ ] Add dimensions if available

### **Long-term (Enhancement):**
- [ ] Add vehicle history tracking
- [ ] Add towing/payload capacity for applicable vehicles
- [ ] Add acceleration specs if available
- [ ] Add weight information

---

## 🔗 Related Files

- **Detail Modal**: `apps/dealer-dashboard/src/components/dashboard/inventory/vehicle-detail-modal.tsx`
- **UVS Schema**: `packages/shared/src/uvs.ts`
- **MarketCheck Normalization**: `apps/mcp-server/src/ingestion/providers/marketcheck.ts`
- **MarketCheck Interface**: `packages/shared/src/marketcheck.ts`
- **Enrichment**: `packages/shared/src/marketcheck-enrichment.ts`

