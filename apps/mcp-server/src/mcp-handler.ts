import { getAvailableTools, getAvailableResources, handleMcpToolCall } from './mcp-simple.js';

/**
 * Handle MCP protocol requests
 */
export async function handleMcpRequest(body: unknown, context?: { ipAddress?: string; widgetState?: unknown }) {
  try {
    const request = body as { 
      jsonrpc?: string; 
      method: string; 
      params?: unknown; 
      id?: number | string;
    };

    const { method, params = {}, id } = request;

    // Helper function to create JSON-RPC 2.0 response
    const createResponse = (result: unknown) => ({
      jsonrpc: '2.0',
      id: id || null,
      result
    });

    const createError = (code: number, message: string, data?: unknown) => ({
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
          protocolVersion: (params as { protocolVersion?: unknown }).protocolVersion,
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
        if ((params as { name?: string }).name) {
          const toolStartTime = Date.now();
          
          // Send progress notification for long-running operations
          if ((params as { name?: string }).name === 'search-vehicles') {
            console.log('🔍 Starting vehicle search...');
            // Simulate progress notification
            setTimeout(() => {
              console.log('📊 Search progress: 50% complete');
            }, 100);
          }
          
          const result = await handleMcpToolCall((params as { name: string }).name, (params as { arguments?: unknown }).arguments, context);
          
          const toolDuration = Date.now() - toolStartTime;
          console.log(JSON.stringify({
            evt: 'mcp.tools.call',
            tool: (params as { name: string }).name,
            ms: toolDuration,
            success: result.success !== false
          }));
          
          if (result.success === false) {
            return createError(-32603, 'Internal error', (result as { error?: unknown }).error);
          }
          
          // Return the result directly with components pattern
          const resultData = (result as { data?: unknown }).data;
          if (resultData && (resultData as { components?: unknown }).components) {
            // New components pattern
            const data = resultData as { content?: unknown; structuredContent?: unknown; components?: unknown };
            return createResponse({
              content: data.content,
              structuredContent: data.structuredContent,
              components: data.components
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
        if ((params as { name?: string }).name) {
          const result = await handleMcpToolCall((params as { name: string }).name, (params as { arguments?: unknown }).arguments, context);
          
          if (result.success === false) {
            return createError(-32603, 'Internal error', (result as { error?: unknown }).error);
          }
          
          const resultData = result as { data?: unknown; structuredContent?: unknown };
          return createResponse(resultData.data || resultData.structuredContent);
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
      id: (body as { id?: unknown })?.id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
