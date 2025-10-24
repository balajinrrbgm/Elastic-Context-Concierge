import { ElasticsearchClient, SearchResponse, SearchResult } from '../elasticsearch/client.js';
import { VertexAIClient } from '../vertex/client.js';

interface SearchFilters {
  dateRange?: { start?: string; end?: string };
  category?: string[];
  department?: string[];
  tags?: string[];
}

interface SearchOptions {
  enableReranking?: boolean;
  includeAggregations?: boolean;
  useHybridSearch?: boolean;
  boostRecentDocuments?: boolean;
  includeHighlights?: boolean;
}

export function createSearchTool(esClient: ElasticsearchClient, vertexClient: VertexAIClient) {
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
        useHybridSearch = true,
        boostRecentDocuments = true,
        includeHighlights = true
      } = options;

      try {
        let searchResponse: SearchResponse;

        if (useHybridSearch) {
          // Generate query embedding for hybrid search
          const embedding = await vertexClient.generateEmbedding(query);
          
          searchResponse = await esClient.hybridSearch(query, embedding, {
            size: enableReranking ? topK * 3 : topK,
            textWeight: 0.7,
            semanticWeight: 0.3,
            categories: filters?.category,
            departments: filters?.department
          });
        } else {
          // Use standard text search
          searchResponse = await esClient.search(query, {
            size: enableReranking ? topK * 3 : topK,
            categories: filters?.category,
            departments: filters?.department,
            includeHighlights,
            includeAggregations,
            boostRecentDocuments
          });
        }

        let results = searchResponse.results.map((result: SearchResult) => ({
          id: result.id,
          title: result.document.title,
          content: result.document.content,
          summary: result.document.summary || result.document.content.substring(0, 200) + '...',
          category: result.document.category,
          department: result.document.department,
          date: result.document.date,
          tags: result.document.tags || [],
          author: result.document.author,
          source_url: result.document.source_url,
          score: result.score,
          confidence_score: result.document.confidence_score,
          highlights: result.highlights
        }));

        // Apply date filters if specified
        if (filters?.dateRange) {
          results = results.filter(result => {
            const resultDate = new Date(result.date);
            const startDate = filters.dateRange?.start ? new Date(filters.dateRange.start) : null;
            const endDate = filters.dateRange?.end ? new Date(filters.dateRange.end) : null;
            
            if (startDate && resultDate < startDate) return false;
            if (endDate && resultDate > endDate) return false;
            return true;
          });
        }

        // Apply tag filters if specified
        if (filters?.tags && filters.tags.length > 0) {
          results = results.filter(result => 
            filters.tags?.some(tag => result.tags.includes(tag))
          );
        }

        // Semantic reranking for better relevance
        if (enableReranking && results.length > topK) {
          const reranked = await this.rerankResults(query, results, vertexClient, topK);
          results = reranked;
        } else {
          results = results.slice(0, topK);
        }

        // Generate query-specific source attribution
        results = results.map((result, index) => ({
          ...result,
          relevance_rank: index + 1,
          query_match_explanation: this.generateMatchExplanation(query, result)
        }));

        return {
          results,
          totalHits: searchResponse.total,
          searchType: useHybridSearch ? 'hybrid' : 'text-only',
          usedReranking: enableReranking,
          aggregations: searchResponse.aggregations,
          searchMetrics: {
            queryTime: searchResponse.took,
            resultsReturned: results.length,
            totalAvailable: searchResponse.total
          }
        };
      } catch (error: any) {
        console.error('Search execution failed:', error);
        throw new Error(`Search failed: ${error?.message || 'Unknown error'}`);
      }
    },

    async rerankResults(query: string, results: any[], vertexClient: VertexAIClient, topK: number) {
      try {
        const rerankedScores = await vertexClient.rerankDocuments(
          query,
          results.map(r => ({ id: r.id, text: `${r.title} ${r.content}` }))
        );

        // Combine original scores with reranking scores
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
    },

    generateMatchExplanation(query: string, result: any): string {
      const queryWords = query.toLowerCase().split(/\s+/);
      const titleMatches = queryWords.filter(word => 
        result.title.toLowerCase().includes(word)
      );
      const contentMatches = queryWords.filter(word => 
        result.content.toLowerCase().includes(word)
      );

      const explanations = [];
      
      if (titleMatches.length > 0) {
        explanations.push(`Title matches: "${titleMatches.join(', ')}"`);
      }
      
      if (contentMatches.length > 0) {
        explanations.push(`Content matches: "${contentMatches.slice(0, 3).join(', ')}"`);
      }
      
      if (result.category && queryWords.some(word => 
        result.category.toLowerCase().includes(word) || 
        word.includes(result.category.toLowerCase().replace('-', ' '))
      )) {
        explanations.push(`Category relevance: ${result.category}`);
      }

      return explanations.length > 0 
        ? explanations.join('; ') 
        : 'Semantic similarity match';
    },

    // Quick search for simple queries
    async quickSearch(query: string, limit: number = 3) {
      try {
        const response = await esClient.search(query, {
          size: limit,
          includeHighlights: false,
          includeAggregations: false
        });

        return response.results.map((result: SearchResult) => ({
          id: result.id,
          title: result.document.title,
          summary: result.document.summary || result.document.content.substring(0, 150) + '...',
          source_url: result.document.source_url,
          score: result.score
        }));
      } catch (error: any) {
        console.error('Quick search failed:', error);
        return [];
      }
    },

    // Search by category
    async searchByCategory(category: string, limit: number = 10) {
      try {
        const response = await esClient.search('', {
          size: limit,
          categories: [category],
          includeAggregations: false
        });

        return response.results.map((result: SearchResult) => ({
          id: result.id,
          title: result.document.title,
          content: result.document.content,
          source_url: result.document.source_url,
          date: result.document.date,
          author: result.document.author
        }));
      } catch (error: any) {
        console.error('Category search failed:', error);
        return [];
      }
    }
  };
}
