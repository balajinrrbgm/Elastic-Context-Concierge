/**
 * Unit tests for Search Tool
 */

import { createSearchTool } from '../search';

describe('Search Tool', () => {
  let mockEsClient: any;
  let mockVertexClient: any;

  beforeEach(() => {
    // Mock Elasticsearch client
    mockEsClient = {
      search: jest.fn()
    };

    // Mock Vertex AI client
    mockVertexClient = {
      generateEmbedding: jest.fn(),
      rerankDocuments: jest.fn()
    };
  });

  describe('execute', () => {
    it('should perform hybrid search with BM25 and vector search', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      const mockSearchResponse = {
        hits: {
          hits: [
            {
              _id: 'doc1',
              _score: 10.5,
              _source: {
                title: 'Test Document',
                content: 'Test content',
                category: 'Engineering',
                department: 'IT'
              }
            }
          ],
          total: { value: 1 },
          max_score: 10.5
        },
        took: 15,
        aggregations: {
          categories: {
            buckets: [{ key: 'Engineering', doc_count: 1 }]
          }
        }
      };

      mockVertexClient.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockEsClient.search.mockResolvedValue(mockSearchResponse);

      const searchTool = createSearchTool(mockEsClient, mockVertexClient);
      const result = await searchTool.execute('test query', {}, 5);

      expect(mockVertexClient.generateEmbedding).toHaveBeenCalledWith('test query');
      expect(mockEsClient.search).toHaveBeenCalledWith(
        'enterprise_docs',
        expect.objectContaining({
          retriever: expect.objectContaining({
            rrf: expect.any(Object)
          })
        })
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Test Document');
      expect(result.searchType).toBe('hybrid');
    });

    it('should apply filters correctly', async () => {
      const filters = {
        category: ['Engineering'],
        department: ['IT'],
        dateRange: { start: '2024-01-01', end: '2024-12-31' }
      };

      mockVertexClient.generateEmbedding.mockResolvedValue([]);
      mockEsClient.search.mockResolvedValue({
        hits: { hits: [], total: { value: 0 } },
        took: 10
      });

      const searchTool = createSearchTool(mockEsClient, mockVertexClient);
      await searchTool.execute('test', filters, 5);

      const searchCall = mockEsClient.search.mock.calls[0][1];
      expect(searchCall.retriever.rrf.retrievers[0].standard.query.bool.filter).toBeDefined();
    });

    it('should enable reranking when specified', async () => {
      mockVertexClient.generateEmbedding.mockResolvedValue([]);
      mockVertexClient.rerankDocuments.mockResolvedValue([0.9, 0.8, 0.7]);
      mockEsClient.search.mockResolvedValue({
        hits: {
          hits: [
            { _id: '1', _score: 5, _source: { title: 'Doc 1', content: 'Content 1' } },
            { _id: '2', _score: 4, _source: { title: 'Doc 2', content: 'Content 2' } },
            { _id: '3', _score: 3, _source: { title: 'Doc 3', content: 'Content 3' } }
          ],
          total: { value: 3 }
        },
        took: 20
      });

      const searchTool = createSearchTool(mockEsClient, mockVertexClient);
      const result = await searchTool.execute(
        'test',
        {},
        2,
        { enableReranking: true }
      );

      expect(result.usedReranking).toBe(true);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('rerankResults', () => {
    it('should rerank results using Vertex AI', async () => {
      const results = [
        { id: '1', title: 'Doc 1', content: 'Content 1', score: 5 },
        { id: '2', title: 'Doc 2', content: 'Content 2', score: 4 },
        { id: '3', title: 'Doc 3', content: 'Content 3', score: 3 }
      ];

      mockVertexClient.rerankDocuments.mockResolvedValue([0.9, 0.5, 0.8]);

      const searchTool = createSearchTool(mockEsClient, mockVertexClient);
      const reranked = await searchTool.rerankResults('query', results, mockVertexClient, 2);

      expect(reranked).toHaveLength(2);
      expect(reranked[0].id).toBe('1'); // Highest combined score
    });
  });
});
