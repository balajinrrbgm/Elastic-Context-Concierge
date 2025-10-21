import { VertexAI } from '@google-cloud/vertexai';

export class VertexAIClient {
  private vertexAI: VertexAI;

  constructor(config: { project: string; location: string }) {
    this.vertexAI = new VertexAI(config);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Use `any` here to avoid tight coupling to the exact client types
    // which may change across versions of the Google client libraries.
    const model: any = (this.vertexAI as any).preview.getGenerativeModel({
      model: 'text-embedding-004'
    });
    const result: any = await model.embedContent({ content: text });
    // Be defensive about the shape of the response.
    return result?.embedding?.values ?? [];
  }

  async generateContent(prompt: string): Promise<string> {
    const model: any = (this.vertexAI as any).preview.getGenerativeModel({
      model: 'gemini-2.0-flash-001'
    });
    const result: any = await model.generateContent(prompt);
    // Return a safe string if anything in the response shape is missing.
    return result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}
