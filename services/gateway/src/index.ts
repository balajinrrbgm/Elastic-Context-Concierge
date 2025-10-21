import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createSearchTool } from './tools/search';
import { createSummarizeTool } from './tools/summarize';
import { ElasticsearchClient } from './elasticsearch/client';
import { VertexAIClient } from './vertex/client';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// If any required external configuration is missing, or if MOCK=true,
// fall back to lightweight in-memory mock clients so the service can
// run locally without external Elasticsearch / VertexAI.
const useMock = (process.env.MOCK && process.env.MOCK.toLowerCase() === 'true') ||
  !process.env.ELASTICSEARCH_URL ||
  !process.env.ELASTICSEARCH_API_KEY ||
  !process.env.GOOGLE_CLOUD_PROJECT ||
  !process.env.VERTEX_AI_LOCATION;

let esClient: any;
let vertexClient: any;

if (useMock) {
  console.log('Gateway starting in MOCK mode — external services are not required.');
  // Require the mocks at runtime so they are only loaded when needed.
  const { MockElasticsearchClient, MockVertexAIClient } = require('./mocks/mockClients');
  esClient = new MockElasticsearchClient({});
  vertexClient = new MockVertexAIClient({});
} else {
  console.log('Gateway starting in REAL mode — connecting to external services.');
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
    res.json({ status: 'healthy', elasticsearch: esHealth });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: String(error) });
  }
});

app.post('/tool/search', async (req, res) => {
  try {
    const { query, filters, topK = 5 } = req.body;
    const searchTool = createSearchTool(esClient, vertexClient);
    const result = await searchTool.execute(query, filters, topK);
    res.json(result);
  } catch (error) {
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
    res.status(500).json({ error: String(error) });
  }
});

app.listen(port, () => {
  console.log(`Gateway service listening on port ${port}`);
});
