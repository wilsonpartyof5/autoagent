import { z } from 'zod';

export const ComponentSchema = z.object({
  type: z.literal('iframe'),
  url: z.string().url()
});

export const ToolResultSchema = z.object({
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })).nonempty(),
  structuredContent: z.unknown().optional(),
  components: z.array(ComponentSchema).nonempty()
});

export function validateToolResult(result: unknown) {
  return ToolResultSchema.parse(result);
}
