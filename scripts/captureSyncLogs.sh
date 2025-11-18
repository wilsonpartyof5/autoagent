#!/bin/bash
# Capture sync logs in real-time when sync is triggered

echo "🔍 Monitoring sync logs..."
echo "📝 Logs will be saved to /tmp/sync-logs-$(date +%Y%m%d-%H%M%S).txt"
echo ""
echo "⏳ Waiting for sync to be triggered..."
echo "   Go to http://localhost:3000/app/setup and click 'Sync MarketCheck Inventory'"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""

LOG_FILE="/tmp/sync-logs-$(date +%Y%m%d-%H%M%S).txt"

# Monitor log file for syncMarketCheckInventory entries
tail -f /tmp/dealer-dashboard-sync.log 2>/dev/null | while read line; do
    if echo "$line" | grep -q "syncMarketCheckInventory"; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - $line" | tee -a "$LOG_FILE"
    fi
done

