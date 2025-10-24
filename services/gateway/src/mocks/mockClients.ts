export class MockElasticsearchClient {
  private docs: Array<{ title: string; content: string; source?: string; timestamp?: string; category?: string; department?: string }>;

  constructor(_config?: any) {
    this.docs = [
      { 
        title: 'Cloud Computing Benefits', 
        content: 'Cloud computing provides scalability, cost-efficiency, and accessibility. Organizations can reduce infrastructure costs by 20-30% while gaining elastic scalability and improved disaster recovery capabilities.',
        source: 'tech/cloud_guide',
        category: 'cloud-computing',
        department: 'technology'
      },
      { 
        title: 'Artificial Intelligence Trends', 
        content: 'AI technologies including machine learning, natural language processing, and computer vision are transforming industries. Key trends include generative AI, automated decision-making, and intelligent document processing.',
        source: 'tech/ai_overview',
        category: 'artificial-intelligence',
        department: 'technology'
      },
      { 
        title: 'Database Comparison Guide', 
        content: 'SQL databases like PostgreSQL excel at structured data and ACID compliance. NoSQL databases like MongoDB and Elasticsearch are better for unstructured data, horizontal scaling, and real-time analytics.',
        source: 'tech/database_guide',
        category: 'databases',
        department: 'technology'
      },
      { 
        title: 'Microservices Architecture', 
        content: 'Microservices break applications into small, independent services communicating via APIs. Benefits include improved maintainability, independent deployment, and fault isolation. Best practices include service discovery and API gateways.',
        source: 'tech/architecture_guide',
        category: 'architecture',
        department: 'engineering'
      },
      { 
        title: 'Security Best Practices', 
        content: 'Implement multi-factor authentication, encryption at rest and in transit, regular security audits, and zero-trust architecture. Follow principle of least privilege and maintain security awareness training.',
        source: 'security/guidelines',
        category: 'security',
        department: 'security'
      }
    ];
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async search(_index: string, query: any): Promise<any> {
    const size = (query && query.size) || 5;
    
    // Try to match query terms for better relevance
    let searchTerms = '';
    if (query?.retriever?.rrf?.retrievers) {
      // Extract query from RRF structure
      const stdRetriever = query.retriever.rrf.retrievers.find((r: any) => r.standard);
      if (stdRetriever?.standard?.query?.bool?.must?.multi_match?.query) {
        searchTerms = stdRetriever.standard.query.bool.must.multi_match.query.toLowerCase();
      }
    }

    // Score documents based on relevance to search terms
    const scoredDocs = this.docs.map((d, i) => {
      let score = 1.0 / (i + 1); // Base score
      
      if (searchTerms) {
        const content = (d.title + ' ' + d.content).toLowerCase();
        if (content.includes('cloud') && searchTerms.includes('cloud')) score += 0.5;
        if (content.includes('ai') && (searchTerms.includes('ai') || searchTerms.includes('artificial'))) score += 0.5;
        if (content.includes('database') && searchTerms.includes('database')) score += 0.5;
        if (content.includes('microservice') && searchTerms.includes('microservice')) score += 0.5;
        if (content.includes('security') && searchTerms.includes('security')) score += 0.5;
        if (content.includes('benefit') && searchTerms.includes('benefit')) score += 0.5;
      }
      
      return { doc: d, score, index: i };
    });

    // Sort by score and take top results
    const hits = scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, size)
      .map((item, rank) => ({
        _id: String(item.index + 1),
        _score: item.score,
        _rank: rank + 1,
        _source: {
          ...item.doc,
          summary: item.doc.content.substring(0, 150) + '...',
          date: new Date().toISOString(),
          tags: [item.doc.category?.replace('-', ' ') || 'general'],
          author: 'system'
        }
      }));

    return {
      hits: {
        hits,
        total: { value: this.docs.length },
        max_score: hits[0]?._score || 1.0
      },
      took: Math.floor(Math.random() * 50) + 10,
      aggregations: {
        categories: {
          buckets: [
            { key: 'cloud-computing', doc_count: 2 },
            { key: 'artificial-intelligence', doc_count: 1 },
            { key: 'databases', doc_count: 1 },
            { key: 'architecture', doc_count: 1 }
          ]
        }
      }
    };
  }
}

export class MockVertexAIClient {
  constructor(_config?: any) {}

  async generateEmbedding(text: string): Promise<number[]> {
    // Produce a deterministic embedding based on the text content
    const seed = Array.from(String(text)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const vector = Array.from({ length: 768 }, (_, i) => {
      return Math.sin((seed + i) * 0.1) * 0.5;
    });
    return vector;
  }

  async generateContent(prompt: string): Promise<string> {
    // Generate more relevant responses based on the prompt content
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('cloud computing') || lowerPrompt.includes('cloud')) {
      return `Based on the provided documents, cloud computing offers several key benefits:

**Cost Efficiency**: Organizations typically see 20-30% reduction in infrastructure costs by moving to cloud services. This comes from eliminating upfront capital expenditures and reducing hardware maintenance overhead.

**Scalability**: Cloud platforms provide elastic scalability, allowing businesses to automatically scale resources up or down based on demand without manual intervention.

**Accessibility**: Cloud services enable access to applications and data from anywhere with an internet connection, supporting remote work and global collaboration.

**Disaster Recovery**: Cloud infrastructure provides improved disaster recovery capabilities with automated backups and geographically distributed data centers.

These benefits make cloud computing an attractive option for businesses looking to modernize their IT infrastructure while reducing costs and improving operational flexibility.

**Sources:**
[1] Cloud Computing Benefits "Cloud computing provides scalability, cost-efficiency, and accessibility. Organizations can reduce infrastructure costs by 20-30%..."`;
    }
    
    if (lowerPrompt.includes('database') || lowerPrompt.includes('sql') || lowerPrompt.includes('nosql')) {
      return `Here's a comparison of SQL vs NoSQL databases based on the available documentation:

**SQL Databases (e.g., PostgreSQL, MySQL)**:
- **Advantages**: ACID compliance, structured data handling, mature ecosystem, strong consistency
- **Best for**: Complex queries, transactions, structured data with clear relationships

**NoSQL Databases (e.g., MongoDB, Elasticsearch)**:  
- **Advantages**: Horizontal scaling, flexible schema, better performance for unstructured data
- **Best for**: Real-time analytics, large-scale applications, unstructured or semi-structured data

**Key Differences**:
- **Data Structure**: SQL uses tables with fixed schemas, NoSQL uses flexible document/key-value structures
- **Scaling**: SQL typically scales vertically, NoSQL scales horizontally
- **Query Language**: SQL uses standardized query language, NoSQL varies by implementation

**Sources:**
[1] Database Comparison Guide "SQL databases like PostgreSQL excel at structured data and ACID compliance. NoSQL databases like MongoDB and Elasticsearch are better for unstructured data..."`;
    }
    
    if (lowerPrompt.includes('microservice') || lowerPrompt.includes('architecture')) {
      return `Microservices architecture involves breaking applications into small, independent services. Here are the key principles and benefits:

**Core Principles**:
- **Service Independence**: Each service runs in its own process and can be deployed independently
- **API Communication**: Services communicate through well-defined APIs (typically REST or GraphQL)
- **Single Responsibility**: Each service focuses on a specific business capability

**Benefits**:
- **Improved Maintainability**: Smaller codebases are easier to understand and modify
- **Independent Deployment**: Teams can deploy services without affecting others
- **Technology Diversity**: Different services can use different technologies and frameworks
- **Fault Isolation**: Issues in one service don't cascade to others

**Implementation Considerations**:
- Service discovery mechanisms
- API gateway patterns
- Data consistency strategies
- Monitoring and observability

**Sources:**
[1] Microservices Architecture "Microservices break applications into small, independent services communicating via APIs. Benefits include improved maintainability..."`;
    }
    
    if (lowerPrompt.includes('artificial intelligence') || lowerPrompt.includes('ai trends')) {
      return `Current artificial intelligence trends are transforming multiple industries:

**Key AI Technologies**:
- **Machine Learning**: Automated pattern recognition and predictive analytics
- **Natural Language Processing**: Understanding and generating human language
- **Computer Vision**: Image and video analysis capabilities
- **Generative AI**: Creating new content including text, images, and code

**Major Trends**:
- **Generative AI Adoption**: Tools like ChatGPT and similar models becoming mainstream
- **Automated Decision-Making**: AI systems making real-time business decisions
- **Intelligent Document Processing**: Automated extraction and analysis of document content
- **Conversational Interfaces**: AI-powered chatbots and virtual assistants

**Industry Impact**:
AI is revolutionizing sectors including healthcare, finance, manufacturing, and customer service through improved efficiency and new capabilities.

**Sources:**
[1] Artificial Intelligence Trends "AI technologies including machine learning, natural language processing, and computer vision are transforming industries..."`;
    }
    
    // Fallback for other queries
    return `Based on the available documentation, here's a summary of the relevant information:

The query-specific content has been analyzed and the most relevant information has been extracted from the document collection. This response is generated based on the actual document corpus rather than general knowledge.

For more specific information, please refine your query to target particular aspects of the topic you're interested in.

**Sources:**
[1] Relevant Documentation "Query-matched content from the document collection..."`;
  }

  async rerankDocuments(query: string, documents: Array<{id: string, text: string}>): Promise<number[]> {
    // Simple reranking based on term overlap
    const queryTerms = query.toLowerCase().split(' ');
    
    return documents.map(doc => {
      const docText = doc.text.toLowerCase();
      const matchCount = queryTerms.filter(term => docText.includes(term)).length;
      return matchCount / queryTerms.length; // Normalized score
    });
  }
}
