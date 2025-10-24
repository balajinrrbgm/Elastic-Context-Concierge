import { Client } from '@elastic/elasticsearch';

const docs = [
  { title: 'Multi-Factor Authentication Best Practices', content: 'MFA is a critical security mechanism requiring multiple verification methods. Implementation includes hardware keys, backup codes, regular audits, and user training. MFA reduces unauthorized access by over 99%.', category: 'security', department: 'cybersecurity', author: 'Security Team', tags: ['mfa', 'security'], source_url: 'https://docs.company.com/security/mfa', date: '2024-10-22' },
  { title: 'Encryption Strategies for Data Protection', content: 'Enterprise encryption uses AES-256 for data at rest and TLS 1.3 for transit. Key management via HSM with automatic rotation. Critical for GDPR and PCI-DSS compliance.', category: 'security', department: 'data-security', author: 'Security Team', tags: ['encryption', 'security'], source_url: 'https://docs.company.com/security/encryption', date: '2024-10-20' },
  { title: 'Security Incident Response Procedures', content: 'Incident response procedures include detection, classification, isolation of affected systems, forensic analysis, recovery, and post-incident review. Response time SLAs: Critical 15min, High 1hr, Medium 4hrs.', category: 'security', department: 'incident-response', author: 'Incident Response Team', tags: ['incident', 'security'], source_url: 'https://docs.company.com/security/incidents', date: '2024-10-19' },
  { title: 'Customer Support Platform Features', content: 'Our support platform handles multi-channel ticket management with intelligent routing, AI-powered automation, real-time chat with video integration, and comprehensive knowledge base. First response 5 minutes, resolution 24 hours.', category: 'product', department: 'customer-success', author: 'Product Team', tags: ['support', 'platform'], source_url: 'https://docs.company.com/support/platform', date: '2024-10-23' },
  { title: 'Customer Support Best Practices', content: 'Support excellence requires 15-minute response times, professional friendly tone, problem-solving approach with escalation only when necessary, continuous training, and quality metrics targeting 90% CSAT.', category: 'process', department: 'customer-success', author: 'Training Team', tags: ['support', 'training'], source_url: 'https://docs.company.com/support/best-practices', date: '2024-10-21' },
  { title: 'AI-Powered Hybrid Search Implementation', content: 'Hybrid search combines BM25 keyword search with vector semantic search using transformers. Reciprocal Rank Fusion merges results. Cross-encoder reranking provides final ordering. NDCG@10 target 0.75+.', category: 'technology', department: 'engineering', author: 'AI Team', tags: ['ai', 'search'], source_url: 'https://docs.company.com/ai/hybrid-search', date: '2024-10-22' },
  { title: 'Natural Language Processing for Enterprises', content: 'NLP techniques include tokenization, NER, POS tagging, sentiment analysis, and topic modeling. Applications: auto-classification, information extraction, summarization, duplicate detection, compliance analysis.', category: 'technology', department: 'data-science', author: 'Data Science Team', tags: ['nlp', 'ai'], source_url: 'https://docs.company.com/ai/nlp', date: '2024-10-20' },
  { title: 'Cloud Infrastructure Architecture', content: 'Cloud architecture requires high availability, scalability, security, cost optimization, and disaster recovery. Components: load balancing, auto-scaling, containerization, microservices, VPC, storage solutions, backups.', category: 'infrastructure', department: 'platform-engineering', author: 'Infrastructure Team', tags: ['cloud', 'devops'], source_url: 'https://docs.company.com/infra/architecture', date: '2024-10-21' },
  { title: 'Kubernetes Deployment Strategies', content: 'K8s deployment strategies include rolling deployments, blue-green, canary, and shadow deployments. Resource management via requests/limits, QoS classes, horizontal pod autoscaling, and GitOps workflows.', category: 'infrastructure', department: 'platform-engineering', author: 'Platform Team', tags: ['kubernetes', 'devops'], source_url: 'https://docs.company.com/infra/kubernetes', date: '2024-10-19' },
  { title: 'Remote Work Policy Guidelines', content: 'Remote work available for most roles with manager approval. Requirements: regular hours 9-5, VPN mandatory, MFA required, professional appearance on calls, secure workspace, reliable internet 25Mbps+. Daily standups and weekly meetings.', category: 'policy', department: 'human-resources', author: 'HR Department', tags: ['remote', 'policy'], source_url: 'https://docs.company.com/policies/remote-work', date: '2024-10-15' }
];

export const ingestData = async (req: any, res: any) => {
  const url = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  const apiKey = process.env.ELASTICSEARCH_API_KEY;

  const client = new Client({
    node: url,
    auth: apiKey ? { apiKey } : undefined
  });

  try {
    console.log('Connecting to Elasticsearch...');
    await client.ping();
    console.log('✓ Connected');

    const indexName = 'enterprise_docs';
    
    // Delete existing index if it exists
    try {
      await client.indices.delete({ index: indexName });
      console.log('✓ Deleted old index');
    } catch (e) {
      // Index doesn't exist yet, that's fine
    }

    // Create index with mappings
    await client.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            title: { type: 'text' },
            content: { type: 'text' },
            category: { type: 'keyword' },
            department: { type: 'keyword' },
            author: { type: 'keyword' },
            tags: { type: 'keyword' },
            source_url: { type: 'keyword' },
            date: { type: 'date' },
            timestamp: { type: 'date' }
          }
        }
      }
    });
    console.log('✓ Created index');

    // Index documents
    for (const doc of docs) {
      await client.index({
        index: indexName,
        body: { ...doc, timestamp: new Date().toISOString() }
      });
    }
    console.log(`✓ Indexed ${docs.length} documents`);

    // Verify
    const count = await client.count({ index: indexName });
    const finalCount = (count as any).count;
    console.log(`✓ Index now has ${finalCount} documents`);
    
    const categories = [...new Set(docs.map(d => d.category))];
    console.log('\nDocuments by category:');
    categories.forEach(cat => {
      const cnt = docs.filter(d => d.category === cat).length;
      console.log(`  - ${cat}: ${cnt}`);
    });

    await client.close();
    res.json({ success: true, message: `Ingested ${finalCount} documents`, categories: categories.length });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: String(error) });
  }
};
