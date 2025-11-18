#!/bin/bash
# Check sync logs in real-time

echo "=== Checking for sync logs ==="
echo ""

# Check log file
if [ -f /tmp/dealer-dashboard-sync.log ]; then
    echo "📄 Recent logs from /tmp/dealer-dashboard-sync.log:"
    tail -50 /tmp/dealer-dashboard-sync.log | grep -A 3 -B 3 "syncMarketCheckInventory" | tail -30
    echo ""
fi

# Check if server is running
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "✅ Server is running on port 3000"
else
    echo "❌ Server is NOT running on port 3000"
fi

echo ""
echo "💡 To see live logs, run:"
echo "   tail -f /tmp/dealer-dashboard-sync.log | grep syncMarketCheckInventory"

