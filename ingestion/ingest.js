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
    
    // First, create the index with proper mappings
    try {
      await esClient.indices.create({
        index: 'enterprise_docs',
        mappings: {
          properties: {
            title: { type: 'text', analyzer: 'standard' },
            content: { type: 'text', analyzer: 'standard' },
            summary: { type: 'text', analyzer: 'standard' },
            category: { 
              type: 'text',
              fields: { keyword: { type: 'keyword' } }
            },
            department: {
              type: 'text', 
              fields: { keyword: { type: 'keyword' } }
            },
            tags: {
              type: 'text',
              fields: { keyword: { type: 'keyword' } }
            },
            author: { type: 'keyword' },
            date: { type: 'date' },
            timestamp: { type: 'date' },
            embedding: {
              type: 'dense_vector',
              dims: 768,
              index: true,
              similarity: 'cosine'
            }
          }
        }
      });
      console.log('✅ Created index: enterprise_docs');
    } catch (error) {
      if (error.meta?.body?.error?.type === 'resource_already_exists_exception') {
        console.log('ℹ️  Index already exists: enterprise_docs');
      } else {
        console.error('❌ Error creating index:', error.message);
        return;
      }
    }

    const docs = [
      { 
        title: 'Cloud Computing Benefits Overview',
        content: 'Cloud computing offers numerous benefits including cost efficiency, scalability, accessibility, and disaster recovery. Organizations can reduce infrastructure costs by up to 25% while improving flexibility and reducing time-to-market for new services.',
        category: 'cloud-computing',
        department: 'technology'
      },
      { 
        title: 'Scalability in Cloud Infrastructure',
        content: 'Cloud platforms provide elastic scalability allowing businesses to automatically scale resources up or down based on demand. This includes auto-scaling of compute instances, storage, and network resources without manual intervention.',
        category: 'cloud-computing', 
        department: 'technology'
      },
      { 
        title: 'Cost Optimization with Cloud Services',
        content: 'Organizations typically see 20-30% cost reduction when migrating to cloud services. Benefits include pay-as-you-use pricing, reduced hardware maintenance, and elimination of upfront capital expenditures.',
        category: 'cloud-computing',
        department: 'finance'
      },
      {
        title: 'Cloud Security Best Practices',
        content: 'Cloud security involves implementing multi-factor authentication, encryption at rest and in transit, regular security audits, and following the shared responsibility model between cloud providers and customers.',
        category: 'security',
        department: 'security'
      },
      {
        title: 'Artificial Intelligence in Enterprise',
        content: 'AI technologies are transforming business operations through automation, predictive analytics, natural language processing, and machine learning. Key trends include generative AI, conversational interfaces, and intelligent document processing.',
        category: 'artificial-intelligence',
        department: 'technology'
      },
      {
        title: 'Database Selection Guide',
        content: 'SQL databases like PostgreSQL and MySQL are ideal for structured data and ACID compliance. NoSQL databases like MongoDB and Elasticsearch excel at handling unstructured data, horizontal scaling, and real-time analytics.',
        category: 'databases',
        department: 'technology'
      },
      {
        title: 'Microservices Architecture Principles',
        content: 'Microservices architecture breaks applications into small, independent services that communicate through APIs. Benefits include improved maintainability, independent deployment, technology diversity, and fault isolation.',
        category: 'architecture',
        department: 'engineering'
      },
      {
        title: 'Hybrid Work Policy Implementation',
        content: 'Successful hybrid work requires clear communication protocols, collaborative technology platforms, flexible scheduling systems, and performance metrics focused on outcomes rather than hours worked.',
        category: 'policy',
        department: 'human-resources'
      }
    ];

    for (const doc of docs) {
      try {
        // Skip Vertex AI for now due to quota limits, use deterministic embedding
        const embedding = Array.from({ length: 768 }, (_, i) => {
          const seed = doc.content.charCodeAt(i % doc.content.length);
          return (Math.sin(seed + i) * 0.5);
        });

        await esClient.index({
          index: 'enterprise_docs',
          document: {
            title: doc.title,
            content: doc.content,
            summary: doc.content.substring(0, 200) + '...',
            category: doc.category,
            department: doc.department,
            embedding: embedding,
            timestamp: new Date(),
            date: new Date().toISOString(),
            tags: [doc.category.replace('-', ' ')],
            author: 'system'
          }
        });
        
        console.log(`✅ Indexed: ${doc.title}`);
      } catch (error) {
        console.error(`❌ Error processing ${doc.title}:`, error.message);
      }
    }

    console.log('Ingestion complete!');
  }

  ingest();
}
