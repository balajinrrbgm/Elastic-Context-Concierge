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
    const { chunks, style = 'comprehensive' } = req.body;
    const summarizeTool = createSummarizeTool(vertexClient);
    const result = await summarizeTool.execute(chunks, style);
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
        const summary = await createSummarizeTool(vertexClient).execute(
          searchResults.results,
          'concise'
        );
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

