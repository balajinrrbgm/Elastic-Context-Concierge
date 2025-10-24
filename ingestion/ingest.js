require('dotenv').config();

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
      { 
        title: 'Product Release v2.5', 
        content: 'New features: AI search, real-time collab. Breaking changes: API v1 deprecated.',
        category: 'product-release',
        department: 'engineering'
      },
      { 
        title: 'Remote Work Policy', 
        content: 'All employees eligible. Requirements: stable internet, VPN, 2FA.',
        category: 'policy',
        department: 'human-resources'
      },
      { 
        title: 'Hybrid Work Policy', 
        content: '3 days office, 2 days remote. Tuesday/Thursday mandatory office days.',
        category: 'policy',
        department: 'human-resources'
      }
    ];

    for (const doc of docs) {
      const embedding = Array.from({ length: 768 }, (_, i) => Math.random());
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
  const fs = require('fs');
  const path = require('path');

  const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL,
    auth: { apiKey: process.env.ELASTICSEARCH_API_KEY }
  });

  const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.VERTEX_AI_LOCATION
  });

  async function generateSourceUrl(title, category) {
    const baseUrl = 'https://docs.company.com';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${baseUrl}/${category}/${slug}`;
  }

  async function ingest() {
    console.log('Starting real document ingestion...');
    
    // First, create the index with proper mappings
    try {
      await esClient.indices.create({
        index: 'enterprise_docs',
        body: {
          mappings: {
            properties: {
              title: { 
                type: 'text', 
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } }
              },
              content: { 
                type: 'text', 
                analyzer: 'standard' 
              },
              summary: { 
                type: 'text', 
                analyzer: 'standard' 
              },
              category: { 
                type: 'text',
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } }
              },
              department: {
                type: 'text',
                analyzer: 'standard', 
                fields: { keyword: { type: 'keyword' } }
              },
              tags: {
                type: 'text',
                analyzer: 'standard',
                fields: { keyword: { type: 'keyword' } }
              },
              author: { type: 'keyword' },
              date: { type: 'date' },
              timestamp: { type: 'date' },
              source_url: { type: 'keyword' },
              confidence_score: { type: 'float' },
              embedding: {
                type: 'dense_vector',
                dims: 768,
                index: true,
                similarity: 'cosine'
              }
            }
          },
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                content_analyzer: {
                  type: 'standard',
                  stopwords: '_english_'
                }
              }
            }
          }
        }
      });
      console.log('✅ Created index: enterprise_docs');
    } catch (error) {
      if (error?.body?.error?.type === 'resource_already_exists_exception') {
        console.log('ℹ️  Index already exists: enterprise_docs');
      } else {
        console.error('❌ Error creating index:', error.message);
        return;
      }
    }

    // Parse sample documents and create comprehensive document set
    const samplePath = path.join(__dirname, '../data/samples/sample-documents.txt');
    let sampleContent = '';
    
    try {
      sampleContent = fs.readFileSync(samplePath, 'utf8');
    } catch (error) {
      console.log('ℹ️  Sample documents not found, using predefined documents');
    }

    const docs = [
      { 
        title: 'Product Release Notes v2.5.0',
        content: 'Advanced AI-powered search with semantic matching, real-time collaboration features, and end-to-end encryption for data security. Breaking changes include API v1 endpoints deprecated (migrate to v2), configuration file format changed, and minimum Node.js version now 18+. Bug fixes include resolved memory leak in document processing and authentication timeout issues.',
        category: 'product-release',
        department: 'engineering',
        author: 'Engineering Team',
        tags: ['ai', 'search', 'collaboration', 'security', 'api']
      },
      { 
        title: 'Remote Work Policy Guidelines',
        content: 'All full-time employees eligible with manager approval. Requirements include stable internet (50 Mbps minimum), dedicated workspace, VPN for all work activities, and two-factor authentication mandatory. Company provides laptop, monitor, keyboard, mouse, and $500 stipend for home office setup.',
        category: 'policy',
        department: 'human-resources',
        author: 'HR Department',
        tags: ['remote work', 'policy', 'equipment', 'security']
      },
      { 
        title: 'Hybrid Work Policy Implementation',
        content: 'Structure: 3 days office, 2 days remote per week. Office days: Tuesday and Thursday mandatory, plus one team-chosen day. Benefits include office amenities access, in-person collaboration, and flexible core hours schedule.',
        category: 'policy',
        department: 'human-resources',
        author: 'HR Department',
        tags: ['hybrid work', 'policy', 'collaboration', 'schedule']
      },
      {
        title: 'Cloud Computing Benefits Overview',
        content: 'Cloud computing offers numerous benefits including cost efficiency, scalability, accessibility, and disaster recovery. Organizations can reduce infrastructure costs by up to 25% while improving flexibility and reducing time-to-market for new services. Key advantages include automatic scaling, pay-as-you-use pricing, and global accessibility.',
        category: 'cloud-computing',
        department: 'technology',
        author: 'Cloud Architecture Team',
        tags: ['cloud', 'benefits', 'cost-efficiency', 'scalability']
      },
      {
        title: 'Scalability in Cloud Infrastructure',
        content: 'Cloud platforms provide elastic scalability allowing businesses to automatically scale resources up or down based on demand. This includes auto-scaling of compute instances, storage, and network resources without manual intervention. Benefits include handling traffic spikes and optimizing resource costs.',
        category: 'cloud-computing', 
        department: 'technology',
        author: 'Infrastructure Team',
        tags: ['scalability', 'cloud', 'auto-scaling', 'infrastructure']
      },
      {
        title: 'Cost Optimization with Cloud Services',
        content: 'Organizations typically see 20-30% cost reduction when migrating to cloud services. Benefits include pay-as-you-use pricing, reduced hardware maintenance, and elimination of upfront capital expenditures. Best practices include rightsizing instances and using reserved capacity.',
        category: 'cloud-computing',
        department: 'finance',
        author: 'Finance Team',
        tags: ['cost optimization', 'cloud', 'pricing', 'savings']
      },
      {
        title: 'Cloud Security Best Practices',
        content: 'Cloud security involves implementing multi-factor authentication, encryption at rest and in transit, regular security audits, and following the shared responsibility model between cloud providers and customers. Key practices include identity management, network security, and data protection.',
        category: 'security',
        department: 'security',
        author: 'Security Team',
        tags: ['security', 'cloud', 'encryption', 'best practices']
      },
      {
        title: 'Artificial Intelligence in Enterprise',
        content: 'AI technologies are transforming business operations through automation, predictive analytics, natural language processing, and machine learning. Key trends include generative AI, conversational interfaces, and intelligent document processing. Implementation requires data strategy and ethical considerations.',
        category: 'artificial-intelligence',
        department: 'technology',
        author: 'AI Research Team',
        tags: ['artificial intelligence', 'machine learning', 'automation', 'nlp']
      },
      {
        title: 'Database Selection Guide',
        content: 'SQL databases like PostgreSQL and MySQL are ideal for structured data and ACID compliance. NoSQL databases like MongoDB and Elasticsearch excel at handling unstructured data, horizontal scaling, and real-time analytics. Selection depends on data structure, consistency requirements, and scaling needs.',
        category: 'databases',
        department: 'technology',
        author: 'Database Team',
        tags: ['databases', 'sql', 'nosql', 'selection guide']
      },
      {
        title: 'Microservices Architecture Principles',
        content: 'Microservices architecture breaks applications into small, independent services that communicate through APIs. Benefits include improved maintainability, independent deployment, technology diversity, and fault isolation. Considerations include service boundaries, data consistency, and monitoring.',
        category: 'architecture',
        department: 'engineering',
        author: 'Architecture Team',
        tags: ['microservices', 'architecture', 'apis', 'scalability']
      }
    ];

    console.log(`📋 Preparing to index ${docs.length} documents...`);

    for (const doc of docs) {
      try {
        // Generate deterministic embedding (avoiding Vertex AI quota issues)
        const embedding = Array.from({ length: 768 }, (_, i) => {
          const seed = doc.content.charCodeAt(i % doc.content.length);
          return (Math.sin(seed + i) * 0.5);
        });

        const sourceUrl = await generateSourceUrl(doc.title, doc.category);
        const now = new Date();
        
        const document = {
          title: doc.title,
          content: doc.content,
          summary: doc.content.substring(0, 200) + '...',
          category: doc.category,
          department: doc.department,
          embedding: embedding,
          timestamp: now.toISOString(),
          date: now.toISOString(),
          tags: doc.tags || [doc.category.replace('-', ' ')],
          author: doc.author || 'system',
          source_url: sourceUrl
        };

        await esClient.index({
          index: 'enterprise_docs',
          body: document
        });
        
        console.log(`✅ Indexed: ${doc.title} [${doc.category}]`);
      } catch (error) {
        console.error(`❌ Error processing ${doc.title}:`, error.message);
      }
    }

    // Verify indexing
    try {
      await esClient.indices.refresh({ index: 'enterprise_docs' });
      const countResponse = await esClient.count({ index: 'enterprise_docs' });
      const docCount = countResponse.body?.count || countResponse.count || 0;
      console.log(`✅ Ingestion complete! Total documents indexed: ${docCount}`);
      
      // Test search
      const testResponse = await esClient.search({
        index: 'enterprise_docs',
        body: {
          query: { match_all: {} },
          size: 1
        }
      });
      
      const testHits = testResponse.body?.hits?.hits || testResponse.hits?.hits || [];
      if (testHits.length > 0) {
        console.log('✅ Search test successful');
        console.log(`   Sample document: ${testHits[0]._source?.title || 'N/A'}`);
      }
      
    } catch (error) {
      console.error('❌ Post-ingestion verification failed:', error.message);
    }
  }

  ingest().catch(console.error);
}
