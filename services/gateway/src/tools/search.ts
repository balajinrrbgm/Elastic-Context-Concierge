interface SearchFilters {
  dateRange?: { start?: string; end?: string };
  category?: string[];
  department?: string[];
  tags?: string[];
}

interface SearchOptions {
  enableReranking?: boolean;
  includeAggregations?: boolean;
  rrfRankConstant?: number;
  rrfWindowSize?: number;
}

export function createSearchTool(esClient: any, vertexClient: any) {
  return {
    async execute(
      query: string,
      filters?: SearchFilters,
      topK: number = 5,
      options: SearchOptions = {}
    ) {
      const {
        enableReranking = true,
        includeAggregations = true,
        rrfRankConstant = 60,
        rrfWindowSize = 100
      } = options;

      // Generate query embedding for vector search
      const embedding = await vertexClient.generateEmbedding(query);

      // Build filter clauses
      const filterClauses: any[] = [];
      if (filters) {
        if (filters.dateRange) {
          filterClauses.push({
            range: {
              date: {
                gte: filters.dateRange.start,
                lte: filters.dateRange.end
              }
            }
          });
        }
        if (filters.category && filters.category.length > 0) {
          filterClauses.push({
            terms: { category: filters.category }
          });
        }
        if (filters.department && filters.department.length > 0) {
          filterClauses.push({
            terms: { department: filters.department }
          });
        }
        if (filters.tags && filters.tags.length > 0) {
          filterClauses.push({
            terms: { tags: filters.tags }
          });
        }
      }

      // Enhanced hybrid search with RRF (Reciprocal Rank Fusion)
      const esQuery: any = {
        retriever: {
          rrf: {
            retrievers: [
              // BM25 Lexical Search with boosted fields
              {
                standard: {
                  query: {
                    bool: {
                      must: {
                        multi_match: {
                          query: query,
                          fields: ['title^3', 'content', 'summary^2', 'keywords^1.5'],
                          type: 'best_fields',
                          fuzziness: 'AUTO',
                          operator: 'or'
                        }
                      },
                      filter: filterClauses.length > 0 ? filterClauses : undefined
                    }
                  }
                }
              },
              // Dense Vector Semantic Search
              {
                knn: {
                  field: 'embedding',
                  query_vector: embedding,
                  k: topK * 2,
                  num_candidates: rrfWindowSize,
                  filter: filterClauses.length > 0 ? { bool: { filter: filterClauses } } : undefined
                }
              }
            ],
            rank_constant: rrfRankConstant,
            rank_window_size: rrfWindowSize
          }
        },
        size: enableReranking ? topK * 3 : topK,
        _source: ['title', 'content', 'summary', 'category', 'department', 'date', 'tags', 'author']
      };

      // Add aggregations for faceted search
      if (includeAggregations) {
        esQuery.aggs = {
          categories: {
            terms: { field: 'category.keyword', size: 10 }
          },
          departments: {
            terms: { field: 'department.keyword', size: 10 }
          },
          tags: {
            terms: { field: 'tags.keyword', size: 20 }
          },
          date_histogram: {
            date_histogram: {
              field: 'date',
              calendar_interval: 'month'
            }
          }
        };
      }

      const response = await esClient.search('enterprise_docs', esQuery);

      let results = response.hits.hits.map((hit: any) => ({
        id: hit._id,
        title: hit._source.title,
        content: hit._source.content,
        summary: hit._source.summary,
        category: hit._source.category,
        department: hit._source.department,
        date: hit._source.date,
        tags: hit._source.tags,
        author: hit._source.author,
        score: hit._score,
        rank: hit._rank
      }));

      // Semantic reranking with cross-encoder (simulate with Vertex AI)
      if (enableReranking && results.length > topK) {
        const reranked = await this.rerankResults(query, results, vertexClient, topK);
        results = reranked;
      }

      // Extract aggregations for faceted search
      const aggregations = includeAggregations ? {
        categories: response.aggregations?.categories?.buckets || [],
        departments: response.aggregations?.departments?.buckets || [],
        tags: response.aggregations?.tags?.buckets || [],
        dateDistribution: response.aggregations?.date_histogram?.buckets || []
      } : undefined;

      return {
        results,
        totalHits: response.hits.total.value,
        usedHybrid: true,
        usedReranking: enableReranking,
        aggregations,
        searchMetrics: {
          queryTime: response.took,
          maxScore: response.hits.max_score,
          rrfRankConstant,
          rrfWindowSize
        }
      };
    },

    async rerankResults(query: string, results: any[], vertexClient: any, topK: number) {
      // Use Vertex AI to rerank results based on semantic similarity
      try {
        const rerankedScores = await vertexClient.rerankDocuments(
          query,
          results.map(r => ({ id: r.id, text: `${r.title} ${r.content}` }))
        );

        // Combine original RRF scores with reranking scores
        const combined = results.map((result, idx) => ({
          ...result,
          rerankScore: rerankedScores[idx] || 0,
          combinedScore: (result.score || 0) * 0.4 + (rerankedScores[idx] || 0) * 0.6
        }));

        // Sort by combined score and take top K
        return combined
          .sort((a, b) => b.combinedScore - a.combinedScore)
          .slice(0, topK);
      } catch (error) {
        console.warn('Reranking failed, returning original results:', error);
        return results.slice(0, topK);
      }
    }
  };
}
