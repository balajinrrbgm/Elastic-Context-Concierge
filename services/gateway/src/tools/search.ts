export function createSearchTool(esClient: any, vertexClient: any) {
  return {
    async execute(query: string, filters?: any, topK: number = 5) {
      const embedding = await vertexClient.generateEmbedding(query);

      const esQuery = {
        retriever: {
          rrf: {
            retrievers: [
              {
                standard: {
                  query: {
                    multi_match: {
                      query: query,
                      fields: ['title^3', 'content']
                    }
                  }
                }
              },
              {
                knn: {
                  field: 'embedding',
                  query_vector: embedding,
                  k: topK * 2,
                  num_candidates: 100
                }
              }
            ]
          }
        },
        size: topK
      };

      const response = await esClient.search('enterprise_docs', esQuery);

      return {
        results: response.hits.hits.map((hit: any) => ({
          id: hit._id,
          title: hit._source.title,
          content: hit._source.content,
          score: hit._score
        })),
        totalHits: response.hits.total.value,
        usedHybrid: true
      };
    }
  };
}
