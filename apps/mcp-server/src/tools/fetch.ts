/**
 * OpenAI-required fetch tool for URL content retrieval
 * Returns page content in the documented contents format
 */
export async function fetchContent(params: unknown): Promise<{
  success: boolean;
  data?: {
    content: { type: string; text: string; }[];
    structuredContent?: unknown;
    components: { type: string; url: string; }[];
  };
  error?: string;
}> {
  try {
    // Validate input parameters
    if (!params || typeof params !== 'object') {
      return {
        success: false,
        error: 'Invalid parameters: expected object with url property',
      };
    }

    const { url } = params as { url?: string };
    
    if (!url || typeof url !== 'string') {
      return {
        success: false,
        error: 'Invalid parameters: url is required and must be a string',
      };
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return {
        success: false,
        error: 'Invalid URL format',
      };
    }

    // Fetch the URL content
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'AutoAgent-MCP-Server/1.0.0',
        'Accept': 'text/html,text/plain,application/json,*/*',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Get content type
    const contentType = response.headers.get('content-type') || '';
    
    let content: string;
    if (contentType.includes('application/json')) {
      const jsonData = await response.json();
      content = JSON.stringify(jsonData, null, 2);
    } else {
      content = await response.text();
    }

    // Truncate very long content to prevent issues
    const maxLength = 50000; // 50KB limit
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n\n... (content truncated)';
    }

    return {
      success: true,
      data: {
        content: [
          { 
            type: 'text', 
            text: `Content from ${url}:\n\n${content}` 
          }
        ],
        structuredContent: { 
          url: url,
          status: response.status,
          contentType: contentType,
          contentLength: content.length,
          content: content
        },
        components: [] // No UI components for fetch
      },
    };
  } catch (error) {
    console.error('Fetch tool error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout: URL took too long to respond',
        };
      }
      if (error.message.includes('fetch')) {
        return {
          success: false,
          error: `Network error: ${error.message}`,
        };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
