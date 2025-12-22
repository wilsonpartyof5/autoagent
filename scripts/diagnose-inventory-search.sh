#!/bin/bash
# Diagnostic script to investigate why Inventory Search API returns zero vehicles

set -e

echo "=== INVENTORY SEARCH API DIAGNOSTIC ==="
echo ""

# Load environment variables
if [ -f apps/dealer-dashboard/.env.local ]; then
  source apps/dealer-dashboard/.env.local
elif [ -f .env.vercel ]; then
  source .env.vercel
fi

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY}}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "❌ Error: Supabase credentials not found"
  echo "   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  exit 1
fi

echo "Supabase URL: ${SUPABASE_URL}"
echo "Using key: ${SUPABASE_KEY:0:20}..."
echo ""

# Rock Hill GMC dealer ID
DEALER_ID="11042155"
BOUNDS_NORTH=34.9855
BOUNDS_SOUTH=34.9123
BOUNDS_EAST=-80.9234
BOUNDS_WEST=-81.0123

echo "=== DIAGNOSTIC QUERIES ==="
echo ""

# Query 1: Total vehicles for dealer
echo "1. Total vehicles for dealer_id $DEALER_ID:"
QUERY1="SELECT COUNT(*) as total FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}';"
echo "   SQL: $QUERY1"
curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"${QUERY1}\"}" 2>/dev/null || echo "   (Direct SQL query not available via REST API)"
echo ""

# Query 2: Vehicles with coordinates
echo "2. Vehicles with coordinates (dealer_id $DEALER_ID):"
QUERY2="SELECT COUNT(*) as total FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}' AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL;"
echo "   SQL: $QUERY2"
echo ""

# Query 3: Sample coordinates
echo "3. Sample coordinates (dealer_id $DEALER_ID, first 5):"
QUERY3="SELECT dealer_latitude, dealer_longitude, dealer_name, make, model FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}' AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL LIMIT 5;"
echo "   SQL: $QUERY3"
echo ""

# Query 4: Availability status
echo "4. Availability status distribution (dealer_id $DEALER_ID):"
QUERY4="SELECT availability_status, COUNT(*) as count FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}' GROUP BY availability_status;"
echo "   SQL: $QUERY4"
echo ""

# Query 5: Vehicles in bounds
echo "5. Vehicles in Rock Hill bounds with coordinates:"
QUERY5="SELECT COUNT(*) as total FROM uvs_vehicles WHERE dealer_latitude BETWEEN ${BOUNDS_SOUTH} AND ${BOUNDS_NORTH} AND dealer_longitude BETWEEN ${BOUNDS_WEST} AND ${BOUNDS_EAST} AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL;"
echo "   SQL: $QUERY5"
echo ""

# Query 6: Vehicles in bounds with availability
echo "6. Vehicles in bounds with availability_status = 'available':"
QUERY6="SELECT COUNT(*) as total FROM uvs_vehicles WHERE dealer_latitude BETWEEN ${BOUNDS_SOUTH} AND ${BOUNDS_NORTH} AND dealer_longitude BETWEEN ${BOUNDS_WEST} AND ${BOUNDS_EAST} AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL AND availability_status = 'available';"
echo "   SQL: $QUERY6"
echo ""

echo "=== RECOMMENDED SQL QUERIES TO RUN IN SUPABASE SQL EDITOR ==="
echo ""
echo "Run these queries in Supabase SQL Editor to get exact results:"
echo ""
echo "-- Query 1: Total vehicles for Rock Hill GMC"
echo "SELECT COUNT(*) as total FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}';"
echo ""
echo "-- Query 2: Vehicles with coordinates"
echo "SELECT COUNT(*) as total FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}' AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL;"
echo ""
echo "-- Query 3: Sample coordinates"
echo "SELECT dealer_latitude, dealer_longitude, dealer_name, make, model, availability_status FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}' AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL LIMIT 5;"
echo ""
echo "-- Query 4: Availability status distribution"
echo "SELECT availability_status, COUNT(*) as count FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}' GROUP BY availability_status;"
echo ""
echo "-- Query 5: Vehicles in Rock Hill bounds"
echo "SELECT COUNT(*) as total FROM uvs_vehicles WHERE dealer_latitude BETWEEN ${BOUNDS_SOUTH} AND ${BOUNDS_NORTH} AND dealer_longitude BETWEEN ${BOUNDS_WEST} AND ${BOUNDS_EAST} AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL;"
echo ""
echo "-- Query 6: Vehicles in bounds with availability = 'available'"
echo "SELECT COUNT(*) as total FROM uvs_vehicles WHERE dealer_latitude BETWEEN ${BOUNDS_SOUTH} AND ${BOUNDS_NORTH} AND dealer_longitude BETWEEN ${BOUNDS_WEST} AND ${BOUNDS_EAST} AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL AND availability_status = 'available';"
echo ""
echo "-- Query 7: Check if coordinates are within bounds for dealer"
echo "SELECT id, dealer_latitude, dealer_longitude, dealer_name, availability_status, make, model FROM uvs_vehicles WHERE dealer_id = '${DEALER_ID}' AND dealer_latitude IS NOT NULL AND dealer_longitude IS NOT NULL AND (dealer_latitude < ${BOUNDS_SOUTH} OR dealer_latitude > ${BOUNDS_NORTH} OR dealer_longitude < ${BOUNDS_WEST} OR dealer_longitude > ${BOUNDS_EAST}) LIMIT 10;"
echo ""

