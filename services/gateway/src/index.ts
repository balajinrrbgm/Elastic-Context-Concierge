import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createSearchTool } from './tools/search';
import { createSummarizeTool } from './tools/summarize';
import { createCompareTool } from './tools/compare';
import { createAnalyzeTool } from './tools/analyze';
import { createCiteTool } from './tools/cite';
import { ElasticsearchClient } from './elasticsearch/client';
import { VertexAIClient } from './vertex/client';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Force production mode with environment variables set, fall back to mock only if explicitly requested
const useMock = (process.env.MOCK && process.env.MOCK.toLowerCase() === 'true');

// Check if we have the minimum required config for production
const hasRequiredConfig = process.env.ELASTICSEARCH_URL && 
                         process.env.ELASTICSEARCH_API_KEY && 
                         process.env.GOOGLE_CLOUD_PROJECT && 
                         process.env.VERTEX_AI_LOCATION;

console.log('Environment check:', {
  MOCK: process.env.MOCK,
  hasElasticsearchURL: !!process.env.ELASTICSEARCH_URL,
  hasElasticsearchKey: !!process.env.ELASTICSEARCH_API_KEY,
  hasGCPProject: !!process.env.GOOGLE_CLOUD_PROJECT,
  hasVertexLocation: !!process.env.VERTEX_AI_LOCATION,
  useMock,
  hasRequiredConfig
});

let esClient: any;
let vertexClient: any;

if (useMock || !hasRequiredConfig) {
  console.log('Gateway starting in DEMO mode — using realistic sample data for demonstration.');
  console.log('Missing config:', {
    ELASTICSEARCH_URL: !process.env.ELASTICSEARCH_URL,
    ELASTICSEARCH_API_KEY: !process.env.ELASTICSEARCH_API_KEY,
    GOOGLE_CLOUD_PROJECT: !process.env.GOOGLE_CLOUD_PROJECT,
    VERTEX_AI_LOCATION: !process.env.VERTEX_AI_LOCATION
  });
  // Require the mocks at runtime so they are only loaded when needed.
  const { MockElasticsearchClient, MockVertexAIClient } = require('./mocks/mockClients');
  esClient = new MockElasticsearchClient({});
  vertexClient = new MockVertexAIClient({});
} else {
  console.log('Gateway starting in PRODUCTION mode — connecting to external services.');
  console.log('Config loaded:', {
    elasticsearchUrl: process.env.ELASTICSEARCH_URL?.substring(0, 30) + '...',
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.VERTEX_AI_LOCATION
  });
  esClient = new ElasticsearchClient({
    url: process.env.ELASTICSEARCH_URL!,
    apiKey: process.env.ELASTICSEARCH_API_KEY!
  });

  vertexClient = new VertexAIClient({
    project: process.env.GOOGLE_CLOUD_PROJECT!,
    location: process.env.VERTEX_AI_LOCATION!
  });
}

app.get('/health', async (req, res) => {
  try {
    const esHealth = await esClient.ping();
    res.json({ 
      status: 'healthy', 
      elasticsearch: esHealth,
      mode: (useMock || !hasRequiredConfig) ? 'demo' : 'production',
      version: '2.0.0',
      features: ['hybrid-search', 'reranking', 'multi-agent', 'analytics']
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: String(error) });
  }
});

// Ingest demo data endpoint (for setup)
app.post('/admin/ingest-demo-data', async (req, res) => {
  try {
    // Check authorization (in production, use proper auth)
    const authHeader = req.headers.authorization;
    if (!authHeader?.includes('secret-key')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const demoDocuments = [
      { title: 'Multi-Factor Authentication Best Practices', content: 'MFA is a critical security mechanism requiring multiple verification methods. Implementation includes hardware keys, backup codes, regular audits, and user training. MFA reduces unauthorized access by over 99%.', category: 'security', department: 'cybersecurity', author: 'Security Team', tags: ['mfa', 'security'], source_url: 'https://docs.company.com/security/mfa', date: '2024-10-22', timestamp: new Date().toISOString() },
      { title: 'Encryption Strategies for Data Protection', content: 'Enterprise encryption uses AES-256 for data at rest and TLS 1.3 for transit. Key management via HSM with automatic rotation. Critical for GDPR and PCI-DSS compliance.', category: 'security', department: 'data-security', author: 'Security Team', tags: ['encryption', 'security'], source_url: 'https://docs.company.com/security/encryption', date: '2024-10-20', timestamp: new Date().toISOString() },
      { title: 'Security Incident Response Procedures', content: 'Incident response procedures include detection, classification, isolation of affected systems, forensic analysis, recovery, and post-incident review. Response time SLAs: Critical 15min, High 1hr, Medium 4hrs.', category: 'security', department: 'incident-response', author: 'Incident Response Team', tags: ['incident', 'security'], source_url: 'https://docs.company.com/security/incidents', date: '2024-10-19', timestamp: new Date().toISOString() },
      { title: 'Customer Support Platform Features', content: 'Our support platform handles multi-channel ticket management with intelligent routing, AI-powered automation, real-time chat with video integration, and comprehensive knowledge base. First response 5 minutes, resolution 24 hours.', category: 'product', department: 'customer-success', author: 'Product Team', tags: ['support', 'platform'], source_url: 'https://docs.company.com/support/platform', date: '2024-10-23', timestamp: new Date().toISOString() },
      { title: 'Customer Support Best Practices', content: 'Support excellence requires 15-minute response times, professional friendly tone, problem-solving approach with escalation only when necessary, continuous training, and quality metrics targeting 90% CSAT.', category: 'process', department: 'customer-success', author: 'Training Team', tags: ['support', 'training'], source_url: 'https://docs.company.com/support/best-practices', date: '2024-10-21', timestamp: new Date().toISOString() },
      { title: 'AI-Powered Hybrid Search Implementation', content: 'Hybrid search combines BM25 keyword search with vector semantic search using transformers. Reciprocal Rank Fusion merges results. Cross-encoder reranking provides final ordering. NDCG@10 target 0.75+.', category: 'technology', department: 'engineering', author: 'AI Team', tags: ['ai', 'search'], source_url: 'https://docs.company.com/ai/hybrid-search', date: '2024-10-22', timestamp: new Date().toISOString() },
      { title: 'Natural Language Processing for Enterprises', content: 'NLP techniques include tokenization, NER, POS tagging, sentiment analysis, and topic modeling. Applications: auto-classification, information extraction, summarization, duplicate detection, compliance analysis.', category: 'technology', department: 'data-science', author: 'Data Science Team', tags: ['nlp', 'ai'], source_url: 'https://docs.company.com/ai/nlp', date: '2024-10-20', timestamp: new Date().toISOString() },
      { title: 'Cloud Infrastructure Architecture', content: 'Cloud architecture requires high availability, scalability, security, cost optimization, and disaster recovery. Components: load balancing, auto-scaling, containerization, microservices, VPC, storage solutions, backups.', category: 'infrastructure', department: 'platform-engineering', author: 'Infrastructure Team', tags: ['cloud', 'devops'], source_url: 'https://docs.company.com/infra/architecture', date: '2024-10-21', timestamp: new Date().toISOString() },
      { title: 'Kubernetes Deployment Strategies', content: 'K8s deployment strategies include rolling deployments, blue-green, canary, and shadow deployments. Resource management via requests/limits, QoS classes, horizontal pod autoscaling, and GitOps workflows.', category: 'infrastructure', department: 'platform-engineering', author: 'Platform Team', tags: ['kubernetes', 'devops'], source_url: 'https://docs.company.com/infra/kubernetes', date: '2024-10-19', timestamp: new Date().toISOString() },
      { title: 'Remote Work Policy Guidelines', content: 'Remote work available for most roles with manager approval. Requirements: regular hours 9-5, VPN mandatory, MFA required, professional appearance on calls, secure workspace, reliable internet 25Mbps+. Daily standups and weekly meetings.', category: 'policy', department: 'human-resources', author: 'HR Department', tags: ['remote', 'policy'], source_url: 'https://docs.company.com/policies/remote-work', date: '2024-10-15', timestamp: new Date().toISOString() }
    ];

    console.log(`Ingesting ${demoDocuments.length} documents...`);
    await esClient.bulkIndex(demoDocuments);
    
    res.json({ success: true, message: `Ingested ${demoDocuments.length} demo documents`, categories: 6 });
  } catch (error: any) {
    console.error('Ingestion error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/tool/search', async (req, res) => {
  try {
    const { query, filters, topK = 5, options = {} } = req.body;
    const searchTool = createSearchTool(esClient, vertexClient);
    const result = await searchTool.execute(query, filters, topK, options);
    res.json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/tool/summarize', async (req, res) => {
  try {
    const { query, documents, options = {} } = req.body;
    
    if (!query || !documents || !Array.isArray(documents)) {
      return res.status(400).json({ 
        error: 'Query and documents array are required' 
      });
    }

    const summarizeTool = createSummarizeTool(vertexClient);
    const result = await summarizeTool.execute(query, documents, options);
    res.json(result);
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/tool/compare', async (req, res) => {
  try {
    const { documents, options = {} } = req.body;
    if (!documents || documents.length < 2) {
      return res.status(400).json({ error: 'At least 2 documents required' });
    }
    const compareTool = createCompareTool(vertexClient);
    const result = await compareTool.execute(documents, options);
    res.json(result);
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/tool/analyze', async (req, res) => {
  try {
    const { documents, options = {} } = req.body;
    if (!documents || documents.length === 0) {
      return res.status(400).json({ error: 'At least 1 document required' });
    }
    const analyzeTool = createAnalyzeTool(vertexClient);
    const result = await analyzeTool.execute(documents, options);
    res.json(result);
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/tool/cite', async (req, res) => {
  try {
    const { searchResults, generatedText, style = 'inline' } = req.body;
    const citeTool = createCiteTool();
    const citations = citeTool.extractCitations(searchResults, generatedText);
    const formatted = citeTool.formatCitations(citations, style);
    const citedText = citeTool.injectInlineCitations(generatedText, citations);
    const verification = citeTool.verifyCitations(citedText);
    
    res.json({ 
      citations, 
      formatted, 
      citedText,
      verification
    });
  } catch (error) {
    console.error('Citation error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Agent orchestration endpoint
app.post('/agent/chat', async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body;
    
    // Simple agent orchestration logic
    const intent = await detectIntent(message);
    let response: any;

    switch (intent) {
      case 'search':
        const searchTool = createSearchTool(esClient, vertexClient);
        response = await searchTool.execute(message, context.filters, 5);
        break;
      
      case 'compare':
        if (context.documents && context.documents.length >= 2) {
          const compareTool = createCompareTool(vertexClient);
          response = await compareTool.execute(context.documents);
        } else {
          response = { error: 'Comparison requires at least 2 documents' };
        }
        break;
      
      case 'analyze':
        if (context.documents) {
          const analyzeTool = createAnalyzeTool(vertexClient);
          response = await analyzeTool.execute(context.documents);
        } else {
          response = { error: 'Analysis requires documents' };
        }
        break;
      
      default:
        // Default to search + summarize
        const searchResults = await createSearchTool(esClient, vertexClient).execute(message);
        const summarizeTool = createSummarizeTool(vertexClient);
        
        // Convert search results to the format expected by summarize tool
        const documents = searchResults.results.map((result: any) => ({
          id: result.id,
          title: result.title,
          content: result.content,
          summary: result.summary,
          category: result.category,
          department: result.department,
          author: result.author,
          source_url: result.source_url,
          date: result.date,
          score: result.score,
          confidence_score: result.confidence_score
        }));
        
        const summary = await summarizeTool.execute(message, documents, { style: 'comprehensive' });
        response = { ...searchResults, summary };
    }

    res.json({ 
      intent, 
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Simple intent detection
async function detectIntent(message: string): Promise<string> {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('compare') || lowerMessage.includes('difference')) {
    return 'compare';
  }
  if (lowerMessage.includes('analyze') || lowerMessage.includes('sentiment') || lowerMessage.includes('insight')) {
    return 'analyze';
  }
  if (lowerMessage.includes('search') || lowerMessage.includes('find') || lowerMessage.includes('what')) {
    return 'search';
  }
  
  return 'search'; // Default
}

app.listen(port, () => {
  console.log(`Gateway service listening on port ${port}`);
  console.log(`Mode: ${(useMock || !hasRequiredConfig) ? 'DEMO' : 'PRODUCTION'}`);
  console.log(`Available tools: search, summarize, compare, analyze, cite`);
  if (useMock || !hasRequiredConfig) {
    console.log(`✨ Demo mode active - showcasing AI-powered hybrid search with realistic sample data`);
  }
});

