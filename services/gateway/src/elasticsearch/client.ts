import { Client } from '@elastic/elasticsearch';

export interface SearchDocument {
  title: string;
  content: string;
  summary?: string;
  category: string;
  department: string;
  tags: string[];
  author: string;
  date: string;
  timestamp: string;
  embedding?: number[];
  source_url?: string;
  confidence_score?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  document: SearchDocument;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  took: number;
  aggregations?: Record<string, any>;
}

export class ElasticsearchClient {
  private client: Client;
  private index: string;

  constructor(config: { url: string; apiKey: string; index?: string }) {
    this.client = new Client({
      node: config.url,
      auth: { apiKey: config.apiKey }
    });
    this.index = config.index || 'enterprise_docs';
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Elasticsearch ping failed:', error);
      return false;
    }
  }

  async search(query: string, options?: { 
    size?: number; 
    from?: number;
    categories?: string[];
    departments?: string[];
    includeHighlights?: boolean;
    includeAggregations?: boolean;
    boostRecentDocuments?: boolean;
  }): Promise<SearchResponse> {
    try {
      const searchBody: any = {
        query: this.buildQuery(query, options),
        size: options?.size || 10,
        from: options?.from || 0,
        _source: {
          excludes: ['embedding'] // Exclude large embedding vectors from results
        }
      };

      // Add highlighting
      if (options?.includeHighlights) {
        searchBody.highlight = {
          fields: {
            title: {
              pre_tags: ['<mark>'],
              post_tags: ['</mark>'],
              number_of_fragments: 0
            },
            content: {
              pre_tags: ['<mark>'],
              post_tags: ['</mark>'],
              fragment_size: 150,
              number_of_fragments: 3
            }
          }
        };
      }

      // Add aggregations for faceted search
      if (options?.includeAggregations) {
        searchBody.aggs = {
          categories: {
            terms: { field: 'category.keyword', size: 10 }
          },
          departments: {
            terms: { field: 'department.keyword', size: 10 }
          },
          recent_docs: {
            date_histogram: {
              field: 'timestamp',
              calendar_interval: 'month',
              format: 'yyyy-MM'
            }
          }
        };
      }

      const response = await this.client.search({
        index: this.index,
        body: searchBody
      });

      return this.formatResponse(response);
    } catch (error: any) {
      console.error('Elasticsearch search failed:', error);
      throw new Error(`Search failed: ${error?.message || 'Unknown error'}`);
    }
  }

  private buildQuery(query: string, options?: any) {
    const mustClauses: any[] = [];
    const shouldClauses: any[] = [];
    const filterClauses: any[] = [];

    // Main text search with field boosting
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query: query.trim(),
          fields: [
            'title^3',      // Boost title matches
            'summary^2',    // Boost summary matches
            'content^1',    // Standard content weight
            'tags^1.5'      // Boost tag matches
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'or'
        }
      });

      // Add phrase matching for exact phrases
      shouldClauses.push({
        multi_match: {
          query: query.trim(),
          fields: ['title^2', 'content'],
          type: 'phrase',
          boost: 2
        }
      });
    }

    // Category filters
    if (options?.categories && options.categories.length > 0) {
      filterClauses.push({
        terms: { 'category.keyword': options.categories }
      });
    }

    // Department filters
    if (options?.departments && options.departments.length > 0) {
      filterClauses.push({
        terms: { 'department.keyword': options.departments }
      });
    }

    // Boost recent documents
    if (options?.boostRecentDocuments) {
      shouldClauses.push({
        function_score: {
          query: { match_all: {} },
          functions: [{
            gauss: {
              timestamp: {
                origin: 'now',
                scale: '30d',
                decay: 0.5
              }
            }
          }],
          boost: 1.2
        }
      });
    }

    const boolQuery: any = {};
    
    if (mustClauses.length > 0) {
      boolQuery.must = mustClauses;
    }
    
    if (shouldClauses.length > 0) {
      boolQuery.should = shouldClauses;
    }
    
    if (filterClauses.length > 0) {
      boolQuery.filter = filterClauses;
    }

    // If no specific query, return all documents
    if (Object.keys(boolQuery).length === 0) {
      return { match_all: {} };
    }

    return { bool: boolQuery };
  }

  private formatResponse(response: any): SearchResponse {
    const hits = response.body?.hits?.hits || [];
    
    const results: SearchResult[] = hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      document: {
        ...hit._source,
        confidence_score: this.calculateConfidenceScore(hit._score),
        source_url: this.generateSourceUrl(hit._source)
      },
      highlights: hit.highlight
    }));

    return {
      results,
      total: response.body?.hits?.total?.value || 0,
      took: response.body?.took || 0,
      aggregations: response.body?.aggregations
    };
  }

  private calculateConfidenceScore(elasticScore: number): number {
    // Convert Elasticsearch score to 0-1 confidence score
    // Typical ES scores range from 0-20, normalize to 0-1
    return Math.min(Math.max(elasticScore / 20, 0), 1);
  }

  private generateSourceUrl(document: any): string {
    // Generate source URLs based on document type
    const baseUrl = 'https://docs.company.com';
    const category = document.category || 'general';
    const title = document.title || 'untitled';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    return `${baseUrl}/${category}/${slug}`;
  }

  async hybridSearch(query: string, queryEmbedding?: number[], options?: {
    size?: number;
    textWeight?: number;
    semanticWeight?: number;
    categories?: string[];
    departments?: string[];
  }): Promise<SearchResponse> {
    try {
      const textWeight = options?.textWeight || 0.7;
      const semanticWeight = options?.semanticWeight || 0.3;

      const queries: any[] = [
        {
          multi_match: {
            query: query,
            fields: ['title^3', 'summary^2', 'content^1', 'tags^1.5'],
            type: 'best_fields',
            boost: textWeight
          }
        }
      ];

      // Add semantic search if embedding provided
      if (queryEmbedding && queryEmbedding.length > 0) {
        queries.push({
          script_score: {
            query: { match_all: {} },
            script: {
              source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
              params: { query_vector: queryEmbedding }
            },
            boost: semanticWeight
          }
        });
      }

      const searchBody: any = {
        query: {
          bool: {
            should: queries,
            minimum_should_match: 1
          }
        },
        size: options?.size || 10,
        _source: {
          excludes: ['embedding']
        }
      };

      // Add filters
      if (options?.categories || options?.departments) {
        searchBody.query.bool.filter = [];
        
        if (options?.categories && options.categories.length > 0) {
          searchBody.query.bool.filter.push({
            terms: { 'category.keyword': options.categories }
          });
        }
        
        if (options?.departments && options.departments.length > 0) {
          searchBody.query.bool.filter.push({
            terms: { 'department.keyword': options.departments }
          });
        }
      }

      const response = await this.client.search({
        index: this.index,
        body: searchBody
      });

      return this.formatResponse(response);
    } catch (error: any) {
      console.error('Hybrid search failed:', error);
      throw new Error(`Hybrid search failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async indexDocument(document: SearchDocument): Promise<string> {
    try {
      const response = await this.client.index({
        index: this.index,
        body: {
          ...document,
          timestamp: new Date().toISOString()
        }
      });

      return (response as any).body?._id || response._id;
    } catch (error: any) {
      console.error('Document indexing failed:', error);
      throw new Error(`Indexing failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async bulkIndex(documents: SearchDocument[]): Promise<void> {
    try {
      const body = documents.flatMap(doc => [
        { index: { _index: this.index } },
        { ...doc, timestamp: new Date().toISOString() }
      ]);

      const response = await this.client.bulk({ body });
      
      if ((response as any).body?.errors || response.errors) {
        console.error('Bulk indexing had errors:', (response as any).body?.items || response.items);
        throw new Error('Bulk indexing failed');
      }
    } catch (error: any) {
      console.error('Bulk indexing failed:', error);
      throw new Error(`Bulk indexing failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async createIndex(): Promise<void> {
    try {
      await this.client.indices.create({
        index: this.index,
        body: {
          mappings: {
            properties: {
              title: { 
                type: 'text', 
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } }
              },
              content: { 
                type: 'text', 
                analyzer: 'standard' 
              },
              summary: { 
                type: 'text', 
                analyzer: 'standard' 
              },
              category: { 
                type: 'text',
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } }
              },
              department: {
                type: 'text',
                analyzer: 'standard', 
                fields: { keyword: { type: 'keyword' } }
              },
              tags: {
                type: 'text',
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } }
              },
              author: { type: 'keyword' },
              date: { type: 'date' },
              timestamp: { type: 'date' },
              source_url: { type: 'keyword' },
              confidence_score: { type: 'float' },
              embedding: {
                type: 'dense_vector',
                dims: 768,
                index: true,
                similarity: 'cosine'
              }
            }
          },
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                content_analyzer: {
                  type: 'standard',
                  stopwords: '_english_'
                }
              }
            }
          }
        }
      });
      console.log(`✅ Created index: ${this.index}`);
    } catch (error: any) {
      if (error?.meta?.body?.error?.type === 'resource_already_exists_exception') {
        console.log(`ℹ️  Index already exists: ${this.index}`);
      } else {
        console.error('❌ Error creating index:', error);
        throw error;
      }
    }
  }

  // Legacy method for backward compatibility
  async search_legacy(index: string, query: any): Promise<any> {
    return await this.client.search({ index, ...query });
  }
}
