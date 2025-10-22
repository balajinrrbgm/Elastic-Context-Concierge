/**
 * Metrics Dashboard Endpoint
 * Provides real-time performance metrics and system health
 */

import { Router } from 'express';
import { metricsCollector } from './collector';

const router = Router();

/**
 * GET /metrics
 * Returns comprehensive metrics summary
 */
router.get('/', (req, res) => {
  const summary = metricsCollector.getMetricsSummary();
  
  res.json({
    timestamp: new Date().toISOString(),
    metrics: summary,
    health: calculateHealthStatus(summary)
  });
});

/**
 * GET /metrics/search
 * Returns search-specific metrics
 */
router.get('/search', (req, res) => {
  const summary = metricsCollector.getMetricsSummary();
  res.json({
    timestamp: new Date().toISOString(),
    ...summary.searchMetrics
  });
});

/**
 * GET /metrics/ai
 * Returns AI/ML-specific metrics
 */
router.get('/ai', (req, res) => {
  const summary = metricsCollector.getMetricsSummary();
  res.json({
    timestamp: new Date().toISOString(),
    ...summary.aiMetrics
  });
});

/**
 * GET /metrics/agents
 * Returns agent execution metrics
 */
router.get('/agents', (req, res) => {
  const summary = metricsCollector.getMetricsSummary();
  res.json({
    timestamp: new Date().toISOString(),
    ...summary.agentMetrics
  });
});

/**
 * GET /metrics/system
 * Returns system health metrics
 */
router.get('/system', (req, res) => {
  const summary = metricsCollector.getMetricsSummary();
  res.json({
    timestamp: new Date().toISOString(),
    ...summary.systemMetrics,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});

/**
 * GET /metrics/dashboard
 * Returns formatted dashboard data
 */
router.get('/dashboard', (req, res) => {
  const summary = metricsCollector.getMetricsSummary();
  const health = calculateHealthStatus(summary);

  res.json({
    timestamp: new Date().toISOString(),
    overview: {
      status: health.status,
      uptime: formatUptime(summary.systemMetrics.uptime),
      totalRequests: summary.systemMetrics.requestCount,
      errorRate: `${(summary.systemMetrics.errorRate * 100).toFixed(2)}%`
    },
    search: {
      totalSearches: summary.searchMetrics.totalSearches,
      avgLatency: `${summary.searchMetrics.avgQueryTime.toFixed(0)}ms`,
      p95Latency: `${summary.searchMetrics.p95QueryTime.toFixed(0)}ms`,
      p99Latency: `${summary.searchMetrics.p99QueryTime.toFixed(0)}ms`,
      hybridSearchRate: `${(summary.searchMetrics.hybridSearchRate * 100).toFixed(1)}%`,
      rerankingRate: `${(summary.searchMetrics.rerankingRate * 100).toFixed(1)}%`,
      avgRelevance: summary.searchMetrics.avgRelevanceScore.toFixed(2)
    },
    ai: {
      totalSummarizations: summary.aiMetrics.totalSummarizations,
      avgGenTime: `${summary.aiMetrics.avgGenerationTime.toFixed(0)}ms`,
      totalTokens: summary.aiMetrics.totalTokensUsed,
      avgTokensPerRequest: summary.aiMetrics.avgTokensPerRequest.toFixed(0)
    },
    agents: {
      totalExecutions: summary.agentMetrics.totalExecutions,
      successRate: `${(summary.agentMetrics.successRate * 100).toFixed(2)}%`,
      avgExecutionTime: `${summary.agentMetrics.avgExecutionTime.toFixed(0)}ms`,
      topAgents: Object.entries(summary.agentMetrics.executionsByAgent)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, executions: count }))
    },
    alerts: health.alerts
  });
});

/**
 * POST /metrics/reset
 * Resets all collected metrics (admin only)
 */
router.post('/reset', (req, res) => {
  // In production, add authentication check here
  metricsCollector.resetMetrics();
  res.json({ message: 'Metrics reset successfully' });
});

function calculateHealthStatus(summary: any) {
  const alerts: string[] = [];
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check error rate
  if (summary.systemMetrics.errorRate > 0.1) {
    alerts.push(`High error rate: ${(summary.systemMetrics.errorRate * 100).toFixed(2)}%`);
    status = 'degraded';
  }
  if (summary.systemMetrics.errorRate > 0.25) {
    status = 'unhealthy';
  }

  // Check search latency
  if (summary.searchMetrics.p95QueryTime > 300) {
    alerts.push(`High search latency (p95): ${summary.searchMetrics.p95QueryTime.toFixed(0)}ms`);
    status = status === 'healthy' ? 'degraded' : status;
  }
  if (summary.searchMetrics.p95QueryTime > 1000) {
    status = 'unhealthy';
  }

  // Check AI generation time
  if (summary.aiMetrics.avgGenerationTime > 2000) {
    alerts.push(`Slow AI generation: ${summary.aiMetrics.avgGenerationTime.toFixed(0)}ms`);
    status = status === 'healthy' ? 'degraded' : status;
  }

  // Check agent success rate
  if (summary.agentMetrics.successRate < 0.95) {
    alerts.push(`Low agent success rate: ${(summary.agentMetrics.successRate * 100).toFixed(2)}%`);
    status = status === 'healthy' ? 'degraded' : status;
  }

  return { status, alerts };
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default router;
