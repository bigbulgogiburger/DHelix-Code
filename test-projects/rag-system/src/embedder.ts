export interface EmbedderConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

export class Embedder {
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(config: EmbedderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'text-embedding-3-small';
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ input: texts, model: this.model })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Error ${response.status}: ${errorData.message}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }
}

export async function createEmbedder(apiKey: string): Promise<Embedder> {
  return new Embedder({ apiKey });
}
