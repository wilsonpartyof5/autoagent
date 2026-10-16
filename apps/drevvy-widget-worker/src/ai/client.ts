import OpenAI from 'openai';

import type { ChatClient, ChatContentPart, ChatMessage } from './types';

export function createChatClient(input: { apiKey: string; baseUrl: string; model: string }): ChatClient {
  const client = new OpenAI({ apiKey: input.apiKey, baseURL: input.baseUrl });
  return {
    async complete(request) {
      return completeCompatible(client, input.model, request.messages);
    },
  };
}

async function completeCompatible(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  try {
    return await create(client, model, messages, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/response_format|json_object/i.test(message)) throw error;
    return create(client, model, messages, false);
  }
}

async function create(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
  jsonObject: boolean,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: messages.map(toOpenAIMessage),
    ...(jsonObject ? { response_format: { type: 'json_object' as const } } : {}),
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('AI response was empty.');
  return content;
}

function toOpenAIMessage(message: ChatMessage): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  if (typeof message.content === 'string') {
    return { role: message.role, content: message.content };
  }
  return {
    role: 'user',
    content: message.content.map(toOpenAIPart),
  };
}

function toOpenAIPart(part: ChatContentPart): OpenAI.Chat.Completions.ChatCompletionContentPart {
  if (part.type === 'text') return { type: 'text', text: part.text };
  return {
    type: 'image_url',
    image_url: { url: `data:${part.mediaType};base64,${part.imageBase64}` },
  };
}
