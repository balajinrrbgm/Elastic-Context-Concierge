// Temporary solution: Create query-specific responses in the mock client
// This will fix the immediate issue while we resolve Elasticsearch connectivity

const fs = require('fs');

const enhancedMockClient = `
export class MockElasticsearchClient {
  constructor(config) {
    this.config = config;
  }

  async ping() {
    return true;
  }

  // Generate query-specific mock data based on the search query
  generateQuerySpecificResults(query) {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('security') || queryLower.includes('best practices')) {
      return [
        {
          id: 'security-001',
          title: 'Security Best Practices for Cloud Infrastructure',
          content: 'Comprehensive security guidelines for cloud environments including access controls, encryption, monitoring, and compliance frameworks.',
          category: 'security',
          department: 'cybersecurity',
          tags: ['security', 'cloud', 'best-practices'],
          author: 'Security Team',
          date: '2024-10-20',
          source_url: 'https://docs.company.com/security/cloud-practices',
          confidence_score: 0.95
        },
        {
          id: 'security-002', 
          title: 'Multi-Factor Authentication Implementation Guide',
          content: 'Step-by-step guide for implementing MFA across enterprise systems to enhance security posture.',
          category: 'security',
          department: 'cybersecurity',
          tags: ['mfa', 'authentication', 'security'],
          author: 'Identity Team',
          date: '2024-10-18',
          source_url: 'https://docs.company.com/security/mfa-guide',
          confidence_score: 0.88
        }
      ];
    }
    
    if (queryLower.includes('ai') || queryLower.includes('artificial intelligence') || queryLower.includes('search')) {
      return [
        {
          id: 'ai-001',
          title: 'AI-Powered Search Implementation Strategy',
          content: 'Guide to implementing AI-powered search using Elasticsearch and machine learning for enhanced user experience.',
          category: 'technology',
          department: 'engineering',
          tags: ['ai', 'search', 'ml', 'elasticsearch'],
          author: 'AI Team',
          date: '2024-10-22',
          source_url: 'https://docs.company.com/ai/search-strategy',
          confidence_score: 0.92
        },
        {
          id: 'ai-002',
          title: 'Natural Language Processing Best Practices',
          content: 'Comprehensive guide to NLP techniques for document analysis and content understanding.',
          category: 'technology',
          department: 'data-science',
          tags: ['nlp', 'ai', 'text-analysis'],
          author: 'Data Science Team',
          date: '2024-10-19',
          source_url: 'https://docs.company.com/ai/nlp-practices',
          confidence_score: 0.89
        }
      ];
    }
    
    if (queryLower.includes('cloud') || queryLower.includes('infrastructure')) {
      return [
        {
          id: 'cloud-001',
          title: 'Cloud Infrastructure Optimization Guide',
          content: 'Best practices for optimizing cloud infrastructure costs while maintaining performance and reliability.',
          category: 'infrastructure',
          department: 'devops',
          tags: ['cloud', 'optimization', 'cost-management'],
          author: 'DevOps Team',
          date: '2024-10-21',
          source_url: 'https://docs.company.com/cloud/optimization',
          confidence_score: 0.91
        },
        {
          id: 'cloud-002',
          title: 'Kubernetes Deployment Strategies',
          content: 'Advanced strategies for deploying applications on Kubernetes with high availability and scalability.',
          category: 'infrastructure',
          department: 'devops',
          tags: ['kubernetes', 'deployment', 'containers'],
          author: 'Platform Team',
          date: '2024-10-17',
          source_url: 'https://docs.company.com/k8s/deployment',
          confidence_score: 0.87
        }
      ];
    }
    
    if (queryLower.includes('customer') || queryLower.includes('support')) {
      return [
        {
          id: 'support-001',
          title: 'Customer Support Platform Features',
          content: 'Overview of key features in our customer support platform including ticket management, automation, and analytics.',
          category: 'product',
          department: 'customer-success',
          tags: ['support', 'platform', 'features'],
          author: 'Product Team',
          date: '2024-10-23',
          source_url: 'https://docs.company.com/support/platform-features',
          confidence_score: 0.94
        },
        {
          id: 'support-002',
          title: 'Automated Response Systems',
          content: 'Implementation of AI-powered automated response systems for faster customer query resolution.',
          category: 'automation',
          department: 'customer-success',
          tags: ['automation', 'ai', 'customer-service'],
          author: 'Automation Team',
          date: '2024-10-20',
          source_url: 'https://docs.company.com/support/automation',
          confidence_score: 0.86
        }
      ];
    }
    
    // Default fallback with diverse content
    return [
      {
        id: 'general-001',
        title: 'Enterprise Documentation Standards',
        content: 'Guidelines for creating and maintaining high-quality enterprise documentation across all departments.',
        category: 'documentation',
        department: 'knowledge-management',
        tags: ['documentation', 'standards', 'enterprise'],
        author: 'Documentation Team',
        date: '2024-10-15',
        source_url: 'https://docs.company.com/standards/documentation',
        confidence_score: 0.75
      }
    ];
  }

  async search(query, options = {}) {
    console.log('Enhanced mock search for query:', query);
    
    const results = this.generateQuerySpecificResults(query);
    
    // Add realistic scoring based on query relevance
    const scoredResults = results.map((doc, index) => {
      const baseScore = 1.0 - (index * 0.15); // Decreasing scores
      const randomVariation = (Math.random() - 0.5) * 0.1;
      const score = Math.max(0.1, baseScore + randomVariation);
      
      return {
        id: doc.id,
        score: score,
        document: doc,
        highlights: {
          content: [doc.content.substring(0, 150) + '...']
        }
      };
    });
    
    return {
      results: scoredResults,
      total: results.length,
      took: Math.floor(Math.random() * 50) + 10,
      aggregations: {}
    };
  }

  async hybridSearch(query, embedding, options = {}) {
    console.log('Enhanced mock hybrid search for query:', query);
    return this.search(query, options);
  }

  async index(document) {
    console.log('Mock index operation:', document.title);
    return { result: 'created', _id: 'mock-' + Date.now() };
  }

  async createIndex() {
    console.log('Mock index creation');
    return { acknowledged: true };
  }
}

export class MockVertexAIClient {
  constructor(config) {
    this.config = config;
  }

  async generateEmbedding(text) {
    console.log('Using fallback embeddings for testing purposes');
    return Array.from({length: 768}, () => Math.random() - 0.5);
  }

  async generateEmbeddings(texts) {
    return texts.map(() => this.generateEmbedding());
  }

  async generateContent(prompt) {
    const queryLower = prompt.toLowerCase();
    
    if (queryLower.includes('security')) {
      return 'Based on the search results, here are the key security best practices for cloud infrastructure: 1) Implement multi-factor authentication across all systems, 2) Use encryption for data at rest and in transit, 3) Regular security audits and vulnerability assessments, 4) Follow principle of least privilege for access controls, and 5) Maintain comprehensive monitoring and logging systems.';
    }
    
    if (queryLower.includes('ai') || queryLower.includes('search')) {
      return 'The AI-powered search platform offers several key features: 1) Hybrid search combining keyword and semantic search, 2) Real-time query processing with sub-second response times, 3) Intelligent document ranking using machine learning, 4) Multi-language support and auto-translation, and 5) Advanced analytics and insights into search patterns.';
    }
    
    if (queryLower.includes('customer') || queryLower.includes('support')) {
      return 'Our customer support platform includes these main features: 1) Intelligent ticket routing and prioritization, 2) Automated response suggestions powered by AI, 3) Real-time customer interaction analytics, 4) Integration with multiple communication channels, and 5) Comprehensive reporting and performance metrics dashboard.';
    }
    
    return 'Based on the available information, I can provide insights on various topics including technology implementations, best practices, and enterprise solutions. Please provide more specific details for a more targeted response.';
  }

  async generateText(prompt, options = {}) {
    return this.generateContent(prompt);
  }

  async rerankDocuments(query, documents) {
    return documents.map(() => Math.random());
  }

  async streamContent(prompt) {
    const response = await this.generateContent(prompt);
    async function* generate() {
      const words = response.split(' ');
      for (const word of words) {
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    return generate();
  }
}
`;

console.log('Creating enhanced mock client...');
fs.writeFileSync('./services/gateway/src/mocks/mockClients.ts', enhancedMockClient);
console.log('Enhanced mock client created successfully!');
console.log('This provides query-specific responses while maintaining the enhanced architecture.');