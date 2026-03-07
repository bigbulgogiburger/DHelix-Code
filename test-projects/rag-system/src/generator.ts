import { SearchResult } from './vector-store.js';

export interface GeneratorConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

export interface GeneratedAnswer {
  answer: string;
  sources: string[];
}

export class Generator {
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(config: GeneratorConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gpt-4o-mini';
    this.baseURL = config.baseURL ?? 'https://api.openai.com/v1';
  }

  async generate(query: string, contexts: SearchResult[]): Promise<GeneratedAnswer> {
    const systemPrompt = "You answer questions based on provided context. Cite sources. If context doesn't contain the answer, say so.";
    const userMessage = contexts.map(context => `${context.text} (Source: ${context.source})`).join('\n') + `\nQuery: ${query}`;

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;
    const sources = Array.from(new Set(contexts.map(context => context.source)));

    return { answer, sources };
  }
}