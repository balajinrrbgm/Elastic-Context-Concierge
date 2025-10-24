/**
 * Performance Metrics Collection and Monitoring
 * Tracks search performance, AI latency, and system health
 */

export interface MetricsCollector {
  recordSearch(metrics: SearchMetrics): void;
  recordSummarization(metrics: SummarizationMetrics): void;
  recordAgentExecution(metrics: AgentMetrics): void;
  getMetricsSummary(): MetricsSummary;
}

export interface SearchMetrics {
  queryTime: number;
  elasticsearchTime: number;
  embeddingTime: number;
  rerankingTime: number;
  totalTime: number;
  resultCount: number;
  maxScore: number;
  avgScore: number;
  usedHybrid: boolean;
  usedReranking: boolean;
  filterCount: number;
}

export interface SummarizationMetrics {
  inputTokens: number;
  outputTokens: number;
  generationTime: number;
  modelName: string;
  temperature: number;
}

export interface AgentMetrics {
  agentName: string;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface MetricsSummary {
  searchMetrics: {
    totalSearches: number;
    avgQueryTime: number;
    p95QueryTime: number;
    p99QueryTime: number;
    avgRelevanceScore: number;
    hybridSearchRate: number;
    rerankingRate: number;
  };
  aiMetrics: {
    totalSummarizations: number;
    avgGenerationTime: number;
    totalTokensUsed: number;
    avgTokensPerRequest: number;
  };
  agentMetrics: {
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    executionsByAgent: Record<string, number>;
  };
  systemMetrics: {
    uptime: number;
    requestCount: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

export class InMemoryMetricsCollector implements MetricsCollector {
  private searchMetrics: SearchMetrics[] = [];
  private summarizationMetrics: SummarizationMetrics[] = [];
  private agentMetrics: AgentMetrics[] = [];
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;

  recordSearch(metrics: SearchMetrics): void {
    this.searchMetrics.push(metrics);
    this.requestCount++;
  }

  recordSummarization(metrics: SummarizationMetrics): void {
    this.summarizationMetrics.push(metrics);
  }

  recordAgentExecution(metrics: AgentMetrics): void {
    this.agentMetrics.push(metrics);
    if (!metrics.success) {
      this.errorCount++;
    }
  }

  getMetricsSummary(): MetricsSummary {
    const searchSummary = this.calculateSearchSummary();
    const aiSummary = this.calculateAISummary();
    const agentSummary = this.calculateAgentSummary();
    const systemSummary = this.calculateSystemSummary();

    return {
      searchMetrics: searchSummary,
      aiMetrics: aiSummary,
      agentMetrics: agentSummary,
      systemMetrics: systemSummary
    };
  }

  private calculateSearchSummary() {
    const metrics = this.searchMetrics;
    if (metrics.length === 0) {
      return {
        totalSearches: 0,
        avgQueryTime: 0,
        p95QueryTime: 0,
        p99QueryTime: 0,
        avgRelevanceScore: 0,
        hybridSearchRate: 0,
        rerankingRate: 0
      };
    }

    const queryTimes = metrics.map(m => m.queryTime).sort((a, b) => a - b);
    const scores = metrics.map(m => m.avgScore);
    const hybridCount = metrics.filter(m => m.usedHybrid).length;
    const rerankingCount = metrics.filter(m => m.usedReranking).length;

    return {
      totalSearches: metrics.length,
      avgQueryTime: this.avg(queryTimes),
      p95QueryTime: this.percentile(queryTimes, 0.95),
      p99QueryTime: this.percentile(queryTimes, 0.99),
      avgRelevanceScore: this.avg(scores),
      hybridSearchRate: hybridCount / metrics.length,
      rerankingRate: rerankingCount / metrics.length
    };
  }

  private calculateAISummary() {
    const metrics = this.summarizationMetrics;
    if (metrics.length === 0) {
      return {
        totalSummarizations: 0,
        avgGenerationTime: 0,
        totalTokensUsed: 0,
        avgTokensPerRequest: 0
      };
    }

    const genTimes = metrics.map(m => m.generationTime);
    const totalTokens = metrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);

    return {
      totalSummarizations: metrics.length,
      avgGenerationTime: this.avg(genTimes),
      totalTokensUsed: totalTokens,
      avgTokensPerRequest: totalTokens / metrics.length
    };
  }

  private calculateAgentSummary() {
    const metrics = this.agentMetrics;
    if (metrics.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        avgExecutionTime: 0,
        executionsByAgent: {}
      };
    }

    const executionTimes = metrics.map(m => m.executionTime);
    const successCount = metrics.filter(m => m.success).length;
    const executionsByAgent: Record<string, number> = {};

    metrics.forEach(m => {
      executionsByAgent[m.agentName] = (executionsByAgent[m.agentName] || 0) + 1;
    });

    return {
      totalExecutions: metrics.length,
      successRate: successCount / metrics.length,
      avgExecutionTime: this.avg(executionTimes),
      executionsByAgent
    };
  }

  private calculateSystemSummary() {
    return {
      uptime: Date.now() - this.startTime,
      requestCount: this.requestCount,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      avgResponseTime: this.searchMetrics.length > 0
        ? this.avg(this.searchMetrics.map(m => m.totalTime))
        : 0
    };
  }

  private avg(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private percentile(sortedNumbers: number[], p: number): number {
    if (sortedNumbers.length === 0) return 0;
    const index = Math.ceil(sortedNumbers.length * p) - 1;
    return sortedNumbers[Math.max(0, Math.min(index, sortedNumbers.length - 1))];
  }

  resetMetrics(): void {
    this.searchMetrics = [];
    this.summarizationMetrics = [];
    this.agentMetrics = [];
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
  }
}

// Singleton instance
export const metricsCollector = new InMemoryMetricsCollector();

/**
 * Middleware to track request metrics
 */
export function metricsMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Track basic request metrics
    metricsCollector.recordAgentExecution({
      agentName: 'api_request',
      executionTime: duration,
      success: res.statusCode < 400,
      error: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined
    });
  });

  next();
}
