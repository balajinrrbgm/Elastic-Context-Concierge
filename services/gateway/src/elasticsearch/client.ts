import { Client } from '@elastic/elasticsearch';

export class ElasticsearchClient {
  private client: Client;

  constructor(config: { url: string; apiKey: string }) {
    this.client = new Client({
      node: config.url,
      auth: { apiKey: config.apiKey }
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async search(index: string, query: any): Promise<any> {
    return await this.client.search({ index, ...query });
  }
}
