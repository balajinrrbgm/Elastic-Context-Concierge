export class MockElasticsearchClient {
  private docs: Array<{ title: string; content: string; source?: string; timestamp?: string }>;

  constructor(_config?: any) {
    this.docs = [
      { title: 'Product Release v2.5', content: 'New features: AI search, real-time collab. Breaking changes: API v1 deprecated.', source: 'internal/product_release' },
      { title: 'Remote Work Policy', content: 'All employees eligible. Requirements: stable internet, VPN, 2FA.', source: 'internal/policies' },
      { title: 'Hybrid Work Policy', content: '3 days office, 2 days remote. Tuesday/Thursday mandatory office days.', source: 'internal/policies' },
      { title: 'Security Guidelines', content: 'Use 2FA everywhere. Rotate secrets. No plaintext secrets in repos.', source: 'internal/security' },
      { title: 'Onboarding Guide', content: 'Welcome to the team. Setup your dev environment and join team channels.', source: 'internal/onboarding' }
    ];
  }

  async ping(): Promise<boolean> {
    // Simulate a healthy Elasticsearch instance in mock mode
    return true;
  }

  async search(_index: string, _query: any): Promise<any> {
    // Return a deterministic slice of the sample documents so callers get
    // a shape compatible with the real client.
    const size = (_query && _query.size) || 5;
    const hits = this.docs.slice(0, size).map((d, i) => ({
      _id: String(i + 1),
      _score: 1.0 / (i + 1),
      _source: d
    }));

    return {
      hits: {
        hits,
        total: { value: this.docs.length }
      }
    };
  }
}

export class MockVertexAIClient {
  constructor(_config?: any) {}

  async generateEmbedding(text: string): Promise<number[]> {
    // Produce a small deterministic embedding based on the text's char codes
    const seed = Array.from(String(text)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const vector = Array.from({ length: 8 }, (_, i) => ((seed + i) % 100) / 100);
    return vector;
  }

  async generateContent(prompt: string): Promise<string> {
    const truncated = prompt ? String(prompt).slice(0, 200) : '';
    return `MOCK GENERATED CONTENT: ${truncated}`;
  }
}
