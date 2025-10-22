import { getAvailableTools, getAvailableResources, handleMcpToolCall } from './mcp-simple.js';

/**
 * Handle MCP protocol requests
 */
export async function handleMcpRequest(body: unknown, context?: { ipAddress?: string; widgetState?: any }) {
  try {
    const request = body as { 
      jsonrpc?: string; 
      method: string; 
      params?: any; 
      id?: number | string;
    };

    const { method, params, id } = request;

    // Helper function to create JSON-RPC 2.0 response
    const createResponse = (result: any) => ({
      jsonrpc: '2.0',
      id: id || null,
      result
    });

    const createError = (code: number, message: string, data?: any) => ({
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code,
        message,
        data
      }
    });

    switch (method) {
      case 'initialize':
        console.log('🔧 Initialize request received:', params);
        
        // Send initialized notification immediately after initialize response
        console.log('📢 Sending initialized notification');
        
        return createResponse({
          protocolVersion: params.protocolVersion,
          capabilities: {
            tools: {
              listChanged: true
            },
            resources: {
              subscribe: true,
              listChanged: true
            },
            prompts: {
              listChanged: true
            },
            logging: {}
          },
          serverInfo: {
            name: 'autoagent-mcp-server',
            version: '1.0.0',
          },
          initialized: true,
          notification: {
            jsonrpc: '2.0',
            method: 'initialized',
            params: {}
          }
        });

      case 'initialized':
        console.log('✅ Initialized notification received');
        return createResponse({});

      case 'tools/list':
        console.log('🔧 Tools list request received');
        return createResponse({
          tools: getAvailableTools(),
        });

      case 'resources/list':
        console.log('🔧 Resources list request received');
        return createResponse({
          resources: getAvailableResources(),
        });

      case 'tools/call':
        console.log('🔧 Tools/call request received');
        if (params?.name) {
          const toolStartTime = Date.now();
          
          // Send progress notification for long-running operations
          if (params.name === 'search-vehicles') {
            console.log('🔍 Starting vehicle search...');
            // Simulate progress notification
            setTimeout(() => {
              console.log('📊 Search progress: 50% complete');
            }, 100);
          }
          
          const result = await handleMcpToolCall(params.name, params.arguments, context);
          
          const toolDuration = Date.now() - toolStartTime;
          console.log(JSON.stringify({
            evt: 'mcp.tools.call',
            tool: params.name,
            ms: toolDuration,
            success: result.success !== false
          }));
          
          if (result.success === false) {
            return createError(-32603, 'Internal error', (result as any).error);
          }
          
          // Return the result directly with components pattern
          const resultData = (result as any).data;
          if (resultData && resultData.components) {
            // New components pattern
            return createResponse({
              content: resultData.content,
              structuredContent: resultData.structuredContent,
              components: resultData.components
            });
          } else {
            // If no components, return error - all tools must use components pattern
            return createError(-32603, 'Internal error', 'Tool must return components pattern');
          }
        }
        
        return createError(-32602, 'Invalid params', 'Missing tool name');

      case 'resources/read':
        // Legacy resource-based UI path removed - all UI now uses components pattern
        return createError(-32602, 'Invalid params', 'Resource not found');

      case 'notifications/initialized':
        console.log('✅ Notifications/initialized received');
        return createResponse({});

      case 'notifications/cancelled':
        console.log('❌ Notifications/cancelled received');
        return createResponse({});

      case 'ping':
        console.log('🏓 Ping request received');
        return createResponse({
          pong: 'pong',
          timestamp: new Date().toISOString(),
          server: 'autoagent-mcp-server',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        });

      case 'heartbeat':
        console.log('💓 Heartbeat request received');
        return createResponse({
          status: 'alive',
          timestamp: new Date().toISOString(),
          server: 'autoagent-mcp-server',
          uptime: process.uptime(),
        });

      case 'tools/call/stream':
        console.log('🌊 Tools/call/stream request received');
        // For streaming tool calls, we'll return the same as regular calls for now
        if (params?.name) {
          const result = await handleMcpToolCall(params.name, params.arguments, context);
          
          if (result.success === false) {
            return createError(-32603, 'Internal error', (result as any).error);
          }
          
          return createResponse((result as any).data || (result as any).structuredContent);
        }
        return createError(-32602, 'Invalid params', 'Missing tool name');

      case 'logging/setLevel':
        console.log('📝 Logging/setLevel request received');
        return createResponse({});

      case 'logging/setLogger':
        console.log('📝 Logging/setLogger request received');
        return createResponse({});

      default:
        return createError(-32601, 'Method not found', `Unknown method: ${method}`);
    }
  } catch (error) {
    console.error('MCP handler error:', error);
    return {
      jsonrpc: '2.0',
      id: (body as any)?.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Get the vehicle results widget HTML
 */
function getVehicleResultsWidget(widgetState?: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vehicle Search Results</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .header h1 {
            color: #1e293b;
            font-size: 2rem;
            margin-bottom: 10px;
        }

        .search-summary {
            color: #64748b;
            font-size: 1.1rem;
        }

        .vehicles-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 24px;
            margin-bottom: 30px;
        }

        .vehicle-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .vehicle-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
        }

        .vehicle-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            background: #e2e8f0;
        }

        .vehicle-content {
            padding: 20px;
        }

        .vehicle-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
        }

        .vehicle-price {
            font-size: 1.5rem;
            font-weight: 700;
            color: #059669;
            margin-bottom: 12px;
        }

        .vehicle-details {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
            font-size: 0.9rem;
            color: #64748b;
        }

        .vehicle-detail {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .dealer-info {
            background: #f1f5f9;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 16px;
        }

        .dealer-name {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 4px;
        }

        .dealer-address {
            font-size: 0.9rem;
            color: #64748b;
        }

        .features {
            margin-bottom: 16px;
        }

        .features-title {
            font-size: 0.9rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
        }

        .features-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .feature-tag {
            background: #dbeafe;
            color: #1e40af;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 500;
        }

        .cta-button {
            width: 100%;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .cta-button:hover {
            background: #2563eb;
        }

        .no-results {
            text-align: center;
            padding: 60px 20px;
            color: #64748b;
        }

        .no-results h3 {
            font-size: 1.5rem;
            margin-bottom: 12px;
            color: #374151;
        }

        @media (max-width: 768px) {
            .vehicles-grid {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚗 Vehicle Search Results</h1>
            <div class="search-summary" id="searchSummary">
                Loading search results...
            </div>
        </div>

        <div id="resultsContainer">
            <div class="loading">Loading vehicles...</div>
        </div>
    </div>

    <script>
        // This will be populated with actual data from the MCP server
        function renderResults(data) {
            const container = document.getElementById('resultsContainer');
            const summary = document.getElementById('searchSummary');
            
            if (!data || !data.vehicles || data.vehicles.length === 0) {
                container.innerHTML = \`
                    <div class="no-results">
                        <h3>No vehicles found</h3>
                        <p>Try adjusting your search criteria</p>
                    </div>
                \`;
                summary.textContent = 'No results found';
                return;
            }

            // Update search summary
            const { searchParams } = data;
            const location = searchParams.location || 'your area';
            const condition = searchParams.condition || 'vehicles';
            const maxPrice = searchParams.maxPrice ? \` under $\${searchParams.maxPrice.toLocaleString()}\` : '';
            summary.textContent = \`Found \${data.totalCount} \${condition}\${maxPrice} near \${location}\`;

            // Render vehicle cards
            const vehiclesHtml = data.vehicles.map(vehicle => \`
                <div class="vehicle-card">
                    <img src="\${vehicle.imageUrl || '/placeholder-car.jpg'}" 
                         alt="\${vehicle.year} \${vehicle.make} \${vehicle.model}" 
                         class="vehicle-image"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk0YTNiOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNhciBJbWFnZTwvdGV4dD48L3N2Zz4='">
                    <div class="vehicle-content">
                        <div class="vehicle-title">\${vehicle.year} \${vehicle.make} \${vehicle.model}</div>
                        <div class="vehicle-price">$\${vehicle.price.toLocaleString()}</div>
                        
                        <div class="vehicle-details">
                            \${vehicle.mileage ? \`<div class="vehicle-detail">📊 \${vehicle.mileage.toLocaleString()} miles</div>\` : ''}
                            <div class="vehicle-detail">🏷️ \${vehicle.year}</div>
                        </div>

                        <div class="dealer-info">
                            <div class="dealer-name">\${vehicle.dealer.name}</div>
                            \${vehicle.dealer.address ? \`<div class="dealer-address">\${vehicle.dealer.address}</div>\` : ''}
                        </div>

                        \${vehicle.features && vehicle.features.length > 0 ? \`
                            <div class="features">
                                <div class="features-title">Key Features</div>
                                <div class="features-list">
                                    \${vehicle.features.map(feature => \`<span class="feature-tag">\${feature}</span>\`).join('')}
                                </div>
                            </div>
                        \` : ''}

                        <button class="cta-button" onclick="requestTestDrive('\${vehicle.id}')">
                            🚗 Request Test Drive
                        </button>
                    </div>
                </div>
            \`).join('');

            container.innerHTML = vehiclesHtml;
        }

        function requestTestDrive(vehicleId) {
            // This would integrate with the lead capture system
            alert(\`Test drive requested for vehicle \${vehicleId}. This will be connected to the lead capture system.\`);
        }

        // Initialize with widget state data
        const initialState = ${JSON.stringify(widgetState || {})};
        if (initialState.vehicles && initialState.vehicles.length > 0) {
            renderResults(initialState);
        } else {
            // Initialize with mock data if no data is provided
            setTimeout(() => {
                renderResults({
                    vehicles: [],
                    totalCount: 0,
                    searchParams: {
                        location: 'Seattle, WA',
                        condition: 'used',
                        maxPrice: 30000
                    }
                });
            }, 1000);
        }
    </script>
</body>
</html>
  `;
}