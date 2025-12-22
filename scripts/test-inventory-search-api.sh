#!/bin/bash
# Test script for Inventory Search API endpoint
# Usage: ./scripts/test-inventory-search-api.sh [API_KEY]

set -e

API_KEY="${1:-${INVENTORY_SEARCH_API_KEY}}"
ENDPOINT="${2:-https://autoagent-dealer-dashboard.vercel.app/api/inventory/search}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: $0 <API_KEY> [ENDPOINT]"
  echo "Or set INVENTORY_SEARCH_API_KEY environment variable"
  exit 1
fi

echo "🧪 Testing Inventory Search API"
echo "Endpoint: $ENDPOINT"
echo ""

# Rock Hill, SC bounds (ZIP 29730 area)
REQUEST_BODY='{
  "bounds": {
    "north": 34.9855,
    "south": 34.9123,
    "east": -80.9234,
    "west": -81.0123
  },
  "pagination": {
    "page": 1,
    "limit": 8
  }
}'

echo "📤 Request:"
echo "$REQUEST_BODY" | jq '.' 2>/dev/null || echo "$REQUEST_BODY"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "$REQUEST_BODY")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo "📥 Response (HTTP $HTTP_CODE):"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Validate response
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ HTTP Status: 200 OK"
  
  # Check if response has success field
  if echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
    echo "✅ success: true"
    
    # Check vehicles array
    VEHICLE_COUNT=$(echo "$BODY" | jq '.data.vehicles | length' 2>/dev/null || echo "0")
    if [ "$VEHICLE_COUNT" -gt 0 ]; then
      echo "✅ vehicles array present: $VEHICLE_COUNT vehicles"
      
      # Check first vehicle has required fields
      FIRST_VEHICLE=$(echo "$BODY" | jq '.data.vehicles[0]' 2>/dev/null)
      if [ -n "$FIRST_VEHICLE" ]; then
        HAS_ID=$(echo "$FIRST_VEHICLE" | jq -e '.id' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_LAT=$(echo "$FIRST_VEHICLE" | jq -e '.location.latitude' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_LNG=$(echo "$FIRST_VEHICLE" | jq -e '.location.longitude' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_YEAR=$(echo "$FIRST_VEHICLE" | jq -e '.year' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_MAKE=$(echo "$FIRST_VEHICLE" | jq -e '.make' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_MODEL=$(echo "$FIRST_VEHICLE" | jq -e '.model' > /dev/null 2>&1 && echo "yes" || echo "no")
        HAS_PRICE=$(echo "$FIRST_VEHICLE" | jq -e '.price' > /dev/null 2>&1 && echo "yes" || echo "no")
        
        if [ "$HAS_ID" = "yes" ] && [ "$HAS_LAT" = "yes" ] && [ "$HAS_LNG" = "yes" ]; then
          echo "✅ First vehicle has required fields (id, lat, lng)"
        else
          echo "❌ First vehicle missing required fields"
        fi
        
        # Show sample vehicle
        echo ""
        echo "📋 Sample Vehicle:"
        echo "$FIRST_VEHICLE" | jq '{id, year, make, model, price, location}' 2>/dev/null || echo "$FIRST_VEHICLE"
      fi
    else
      echo "⚠️  vehicles array is empty"
    fi
    
    # Check pagination
    PAGINATION=$(echo "$BODY" | jq '.data.pagination' 2>/dev/null)
    if [ -n "$PAGINATION" ]; then
      echo ""
      echo "📄 Pagination:"
      echo "$PAGINATION" | jq '.' 2>/dev/null || echo "$PAGINATION"
      TOTAL=$(echo "$PAGINATION" | jq -r '.total' 2>/dev/null || echo "0")
      PAGE=$(echo "$PAGINATION" | jq -r '.page' 2>/dev/null || echo "0")
      LIMIT=$(echo "$PAGINATION" | jq -r '.limit' 2>/dev/null || echo "0")
      
      if [ "$TOTAL" -ge 0 ] && [ "$PAGE" -gt 0 ] && [ "$LIMIT" -gt 0 ]; then
        echo "✅ Pagination values are valid"
      else
        echo "❌ Pagination values are invalid"
      fi
    fi
    
    echo ""
    echo "✅ TEST PASSED"
    exit 0
  else
    echo "❌ success field is not true"
    ERROR_CODE=$(echo "$BODY" | jq -r '.error.code' 2>/dev/null || echo "unknown")
    ERROR_MSG=$(echo "$BODY" | jq -r '.error.message' 2>/dev/null || echo "unknown")
    echo "Error: $ERROR_CODE - $ERROR_MSG"
    exit 1
  fi
elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ HTTP Status: 401 Unauthorized"
  echo "Invalid or missing API key"
  exit 1
elif [ "$HTTP_CODE" = "405" ]; then
  echo "❌ HTTP Status: 405 Method Not Allowed"
  echo "Route may not be deployed yet. Deploy the changes to Vercel first."
  exit 1
else
  echo "❌ HTTP Status: $HTTP_CODE"
  exit 1
fi

