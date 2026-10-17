export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageBase64: string; mediaType: 'image/png' };

export type ChatMessage = {
  role: 'system' | 'user';
  content: string | ChatContentPart[];
};

export type ChatRequest = {
  messages: ChatMessage[];
};

export interface ChatClient {
  complete(request: ChatRequest): Promise<string>;
}
