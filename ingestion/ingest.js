const useMock = process.env.MOCK === 'true' ||
  !process.env.ELASTICSEARCH_URL ||
  !process.env.ELASTICSEARCH_API_KEY ||
  !process.env.GOOGLE_CLOUD_PROJECT ||
  !process.env.VERTEX_AI_LOCATION;

if (useMock) {
  console.log('Ingestion running in MOCK mode — external Elasticsearch/VertexAI calls will be simulated.');

  async function ingestMock() {
    console.log('Starting mock ingestion...');
    const docs = [
      { title: 'Product Release v2.5', content: 'New features: AI search, real-time collab. Breaking changes: API v1 deprecated.' },
      { title: 'Remote Work Policy', content: 'All employees eligible. Requirements: stable internet, VPN, 2FA.' },
      { title: 'Hybrid Work Policy', content: '3 days office, 2 days remote. Tuesday/Thursday mandatory office days.' }
    ];

    for (const doc of docs) {
      const embedding = Array.from({ length: 8 }, (_, i) => Math.random());
      console.log('Mock index:', {
        index: 'enterprise_docs',
        document: {
          ...doc,
          embedding,
          timestamp: new Date()
        }
      });
    }

    console.log('Mock ingestion complete!');
  }

  ingestMock();
} else {
  const { Client } = require('@elastic/elasticsearch');
  const { VertexAI } = require('@google-cloud/vertexai');

  const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL,
    auth: { apiKey: process.env.ELASTICSEARCH_API_KEY }
  });

  const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.VERTEX_AI_LOCATION
  });

  async function ingest() {
    console.log('Starting ingestion...');
    const docs = [
      { title: 'Product Release v2.5', content: 'New features: AI search, real-time collab. Breaking changes: API v1 deprecated.' },
      { title: 'Remote Work Policy', content: 'All employees eligible. Requirements: stable internet, VPN, 2FA.' },
      { title: 'Hybrid Work Policy', content: '3 days office, 2 days remote. Tuesday/Thursday mandatory office days.' }
    ];

    for (const doc of docs) {
      const model = vertexAI.preview.getGenerativeModel({ model: 'text-embedding-004' });
      const embedding = await model.embedContent({ content: doc.content });

      await esClient.index({
        index: 'enterprise_docs',
        document: {
          ...doc,
          embedding: embedding.embedding.values,
          timestamp: new Date()
        }
      });
    }

    console.log('Ingestion complete!');
  }

  ingest();
}
