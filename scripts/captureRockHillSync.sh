#!/bin/bash
# Capture Rock Hill GMC sync logs and results
# Usage: ./scripts/captureRockHillSync.sh

set -e

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="/tmp/rock-hill-sync-${TIMESTAMP}.log"
DOC_FILE="docs/marketcheck/dealer-sync-ask-jorge-lopez.md"

echo "============================================================"
echo "Rock Hill GMC Sync Capture"
echo "============================================================"
echo "Timestamp: ${TIMESTAMP}"
echo "Log file: ${LOG_FILE}"
echo ""

# Monitor server logs for syncMarketCheckInventory
echo "📊 Monitoring sync logs..."
echo "   Server log: /tmp/dealer-dashboard-sync.log"
echo "   Waiting for sync to complete..."
echo ""

# Extract sync logs from server log
if [ -f /tmp/dealer-dashboard-sync.log ]; then
    echo "📋 Extracting sync logs..."
    grep -A 50 "syncMarketCheckInventory" /tmp/dealer-dashboard-sync.log | tail -100 > "${LOG_FILE}"
    echo "   Logs extracted to: ${LOG_FILE}"
else
    echo "⚠️  Server log not found: /tmp/dealer-dashboard-sync.log"
    echo "   Run: npm run dev > /tmp/dealer-dashboard-sync.log 2>&1"
fi

echo ""
echo "✅ Sync capture complete"
echo "   Next steps:"
echo "   1. Review logs in: ${LOG_FILE}"
echo "   2. Run: node scripts/verifyRockHillInventory.js"
echo "   3. Update docs with results"

