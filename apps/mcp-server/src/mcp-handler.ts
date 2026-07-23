import { getAvailableTools, getAvailableResources, handleMcpToolCall, readMcpResource, VEHICLE_RESULTS_RESOURCE_URI, VEHICLE_WIDGET_VERSION, type ToolContext } from './mcp-simple.js';
import { CONFIG } from './config/env.js';

/**
 * Handle MCP protocol requests
 */
export async function handleMcpRequest(body: unknown, context?: ToolContext & { widgetState?: unknown }) {
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
      id: id ?? null,
      result
    });

    const createError = (code: number, message: string, data?: unknown) => ({
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code,
        message,
        data
      }
    });

    const extractToolPayload = (toolResult: unknown) => {
      const resultRecord = toolResult as {
        data?: unknown;
        content?: unknown;
        structuredContent?: unknown;
        _meta?: unknown;
      };
      const payload = resultRecord.data ?? resultRecord;
      const payloadRecord = payload as {
        content?: unknown;
        structuredContent?: unknown;
        _meta?: unknown;
      };
      if (payloadRecord.content || payloadRecord.structuredContent) {
        return {
          ...(payloadRecord.content ? { content: payloadRecord.content } : {}),
          ...(payloadRecord.structuredContent
            ? { structuredContent: payloadRecord.structuredContent }
            : {}),
          ...(payloadRecord._meta ? { _meta: payloadRecord._meta } : {}),
        };
      }
      return null;
    };

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
            logging: {},
            experimental: {
              'io.modelcontextprotocol/ui': {
                mimeTypes: ['text/html;profile=mcp-app'],
              },
            },
          },
          serverInfo: {
            name: 'autoagent-mcp-server',
            version: `1.0.0-${VEHICLE_WIDGET_VERSION}-${CONFIG.commitSha.substring(0, 7)}`,
          },
          instructions: `Current vehicle widget version is ${VEHICLE_WIDGET_VERSION} at ${VEHICLE_RESULTS_RESOURCE_URI}. For interactive vehicle inventory UI, use render-vehicle-results-v2. Use search-vehicles only for data-only vehicle searches.`
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
          const toolCallMeta = (params as { _meta?: Record<string, unknown> })._meta || {};
          const toolContext: ToolContext = {
            ...context,
            locale: typeof toolCallMeta['openai/locale'] === 'string' ? toolCallMeta['openai/locale'] : context?.locale,
            userLocation: typeof toolCallMeta['openai/userLocation'] === 'object' && toolCallMeta['openai/userLocation'] !== null
              ? toolCallMeta['openai/userLocation'] as ToolContext['userLocation']
              : context?.userLocation,
          };
          
          // Send progress notification for long-running operations
          if ((params as { name?: string }).name === 'search-vehicles') {
            console.log('🔍 Starting vehicle search...');
            // Simulate progress notification
            setTimeout(() => {
              console.log('📊 Search progress: 50% complete');
            }, 100);
          }
          
          const result = await handleMcpToolCall((params as { name: string }).name, (params as { arguments?: unknown }).arguments, toolContext);
          
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
          
          // Return tool result payload in MCP-compatible shape.
          const resultData = extractToolPayload(result);
          if (resultData) {
            return createResponse(resultData);
          } else {
            return createError(-32603, 'Internal error', 'Tool returned no result data');
          }
        }
        
        return createError(-32602, 'Invalid params', 'Missing tool name');

      case 'resources/read':
        console.log('🔧 Resources read request received');
        try {
          const uri = (params as { uri?: string }).uri;
          if (!uri) {
            return createError(-32602, 'Invalid params', 'Missing resource uri');
          }
          return createResponse(readMcpResource(uri));
        } catch (error) {
          return createError(
            -32602,
            'Invalid params',
            error instanceof Error ? error.message : 'Resource not found'
          );
        }

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
          const toolCallMeta = (params as { _meta?: Record<string, unknown> })._meta || {};
          const toolContext: ToolContext = {
            ...context,
            locale: typeof toolCallMeta['openai/locale'] === 'string' ? toolCallMeta['openai/locale'] : context?.locale,
            userLocation: typeof toolCallMeta['openai/userLocation'] === 'object' && toolCallMeta['openai/userLocation'] !== null
              ? toolCallMeta['openai/userLocation'] as ToolContext['userLocation']
              : context?.userLocation,
          };
          const result = await handleMcpToolCall((params as { name: string }).name, (params as { arguments?: unknown }).arguments, toolContext);
          
          if (result.success === false) {
            return createError(-32603, 'Internal error', (result as { error?: unknown }).error);
          }
          
          const resultData = extractToolPayload(result);
          return resultData
            ? createResponse(resultData)
            : createError(-32603, 'Internal error', 'Tool returned no result data');
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
    
    // Track system error
    const { trackSystemError } = await import('./lib/analytics/tracking.js');
    trackSystemError(
      'mcp_handler_error',
      error instanceof Error ? error.message : 'Unknown error',
      'mcp-handler',
      {
        requestId: (body as { id?: string })?.id?.toString(),
      }
    ).catch(() => {
      // Ignore tracking errors
    });
    
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
