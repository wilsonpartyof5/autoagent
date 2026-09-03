/**
 * Public fetch is disabled. ChatGPT must not be able to ask the server
 * to retrieve arbitrary URLs (SSRF).
 */
export async function fetchContent(_params: unknown): Promise<{
  success: boolean;
  data?: {
    content: { type: string; text: string; }[];
    structuredContent?: unknown;
    components: { type: string; url: string; }[];
  };
  error?: string;
}> {
  return {
    success: false,
    error: 'The fetch tool is disabled.',
  };
}
