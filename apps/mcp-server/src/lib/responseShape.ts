import { z } from 'zod';

export const ComponentSchema = z.object({
  type: z.literal('iframe'),
  url: z.string().url()
});

export const ToolResultSchema = z.object({
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })).nonempty(),
  vehicles: z.array(z.unknown()).optional(),
  totalCount: z.number().optional(),
  searchParams: z.unknown().optional(),
  structuredContent: z.unknown().optional(),
  components: z.array(ComponentSchema).optional()
});

export function validateToolResult(result: unknown) {
  try {
    return ToolResultSchema.parse(result);
  } catch (error) {
    // Log detailed validation error for debugging
    if (error instanceof Error) {
      console.error(JSON.stringify({
        event: 'tool_result_validation_error',
        error: error.message,
        result: result ? JSON.stringify(result).substring(0, 500) : 'null',
      }));
    }
    throw error;
  }
}
