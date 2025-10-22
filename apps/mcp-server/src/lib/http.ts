/**
 * HTTP client with timeout and error handling
 */

export interface HttpOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Fetch with timeout using AbortController
 */
export async function fetchWithTimeout<T = unknown>(
  url: string,
  options: RequestInit & HttpOptions = {},
): Promise<HttpResponse<T>> {
  const { timeout = 2000, headers = {}, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new HttpError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response.statusText,
      );
    }

    const data = await response.json() as T;
    
    return {
      data,
      status: response.status,
      statusText: response.statusText,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof HttpError) {
      throw error;
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HttpError('Request timeout', 408, 'Request Timeout');
    }
    
    throw new HttpError(
      error instanceof Error ? error.message : 'Unknown error',
      0,
      'Network Error',
    );
  }
}
