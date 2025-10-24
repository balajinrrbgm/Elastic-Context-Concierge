# Elastic Context Concierge - Architecture Documentation

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                     │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Next.js Web Application (React + TypeScript)                  │    │
│  │  - Chat Interface with Real-time Updates                       │    │
│  │  - Faceted Search Filters (Category, Department, Date, Tags)   │    │
│  │  - Source Display with Metadata & Citations                    │    │
│  │  - Performance Metrics Dashboard                               │    │
│  └────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS / REST API
┌───────────────────────────────▼─────────────────────────────────────────┐
│                      API GATEWAY LAYER                                   │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Express.js Gateway Service (Cloud Run)                        │    │
│  │  - Request Routing & Validation                                │    │
│  │  - Multi-Agent Orchestration                                   │    │
│  │  - Error Handling & Logging                                    │    │
│  │  - Rate Limiting & Authentication                              │    │
│  └────────────────────────────────────────────────────────────────┘    │
└──────────┬──────────────────────────────────────────┬───────────────────┘
           │                                          │
           ▼                                          ▼
┌──────────────────────────┐           ┌────────────────────────────────┐
│   SEARCH ENGINE LAYER    │           │    AI/ML LAYER                 │
│  ┌────────────────────┐  │           │  ┌──────────────────────────┐ │
│  │ Elasticsearch      │  │           │  │ Google Cloud Vertex AI    │ │
│  │ - Hybrid Search    │  │           │  │ - Gemini 2.0 Flash       │ │
│  │ - BM25 Lexical     │  │           │  │ - Text Embeddings 004    │ │
│  │ - Vector KNN       │  │           │  │ - Semantic Reranking     │ │
│  │ - RRF Fusion       │  │           │  │ - Summarization          │ │
│  │ - Aggregations     │  │           │  │ - Analysis               │ │
│  │ - Filters          │  │           │  └──────────────────────────┘ │
│  └────────────────────┘  │           └────────────────────────────────┘
└──────────────────────────┘
```

## Multi-Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT ORCHESTRATOR                            │
│  - Intent Detection                                              │
│  - Context Management                                            │
│  - Tool Selection & Execution                                    │
└────────┬────────────────────────────────────────────────────────┘
         │
         ├──▶ [Search Agent]
         │    ├─ Hybrid Search (BM25 + Vector + RRF)
         │    ├─ Semantic Reranking
         │    ├─ Filter Application
         │    └─ Aggregation Generation
         │
         ├──▶ [Summarize Agent]
         │    ├─ Multi-Document Summarization
         │    ├─ Style-based Generation (concise/comprehensive)
         │    └─ Citation Extraction
         │
         ├──▶ [Compare Agent]
         │    ├─ Key Point Extraction
         │    ├─ Similarity Analysis
         │    ├─ Difference Highlighting
         │    └─ Comparison Summary
         │
         ├──▶ [Analyze Agent]
         │    ├─ Sentiment Analysis
         │    ├─ Entity Extraction
         │    ├─ Topic Modeling
         │    └─ Insight Generation
         │
         └──▶ [Citation Agent]
              ├─ Source Attribution
              ├─ Relevance Scoring
              ├─ Citation Formatting
              └─ Verification
```

## Hybrid Search Flow

```
User Query: "What is the remote work policy?"
         │
         ▼
┌─────────────────────────┐
│  1. Query Embedding     │
│  Vertex AI Text-004     │
│  768-dim vector         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────────────────────────────┐
│  2. Elasticsearch Hybrid Search                 │
│                                                  │
│  ┌───────────────────┐    ┌──────────────────┐ │
│  │ BM25 Retriever    │    │ KNN Retriever    │ │
│  │ - Field Boosting  │    │ - Vector Search  │ │
│  │ - Fuzziness       │    │ - Cosine Sim     │ │
│  │ - Filters         │    │ - Filters        │ │
│  └─────────┬─────────┘    └────────┬─────────┘ │
│            │                       │            │
│            └───────────┬───────────┘            │
│                        ▼                        │
│            ┌─────────────────────┐              │
│            │ RRF Rank Fusion     │              │
│            │ rank_constant: 60   │              │
│            │ window_size: 100    │              │
│            └──────────┬──────────┘              │
└───────────────────────┼─────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────┐
│  3. Semantic Reranking (Optional)   │
│  - Cross-encoder scoring            │
│  - Combined score weighting         │
│  - Top-K selection                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Aggregation Generation          │
│  - Categories (facets)              │
│  - Departments                      │
│  - Tags                             │
│  - Date histogram                   │
└──────────────┬──────────────────────┘
               │
               ▼
        [Return Results]
```

## Data Flow: Complete Request Cycle

```
1. User Input
   ├─ Query Text: "Summarize Q1 reports"
   ├─ Filters: { department: ["Finance"], category: ["Reports"] }
   └─ Options: { enableReranking: true }

2. API Gateway Processing
   ├─ Validate Request
   ├─ Detect Intent → "search + summarize"
   └─ Route to Tools

3. Search Tool Execution
   ├─ Generate Query Embedding (Vertex AI)
   ├─ Build Elasticsearch Query
   │  ├─ BM25 Multi-Match
   │  ├─ KNN Vector Search
   │  ├─ Apply Filters (department, category)
   │  └─ Add Aggregations
   ├─ Execute Hybrid Search (RRF)
   ├─ Semantic Reranking (Vertex AI)
   └─ Return Top 5 Results + Aggregations

4. Summarize Tool Execution
   ├─ Extract Content from Results
   ├─ Build Summarization Prompt
   ├─ Generate Summary (Vertex AI Gemini)
   └─ Return Formatted Summary

5. Citation Tool Execution
   ├─ Map Summary Sentences to Sources
   ├─ Extract Relevant Snippets
   ├─ Calculate Relevance Scores
   ├─ Format Citations
   └─ Inject Inline Citations

6. Response Assembly
   ├─ Answer (with citations)
   ├─ Sources (with metadata)
   ├─ Aggregations (for filters)
   └─ Metrics (timing, scores)

7. Client Rendering
   ├─ Display Answer in Chat
   ├─ Show Sources with Expandable Content
   ├─ Render Filter Facets
   └─ Display Performance Metrics
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules
- **State Management**: React Hooks
- **HTTP Client**: Fetch API

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **Clients**: 
  - @elastic/elasticsearch (v8.11+)
  - @google-cloud/vertexai (v1.4+)

### Infrastructure
- **Hosting**: Google Cloud Run
- **Search**: Elasticsearch (Elastic Cloud)
- **AI/ML**: Google Cloud Vertex AI
- **Secrets**: Google Cloud Secret Manager
- **IaC**: Terraform
- **CI/CD**: Cloud Build

### Search Engine Configuration
```json
{
  "index": "enterprise_docs",
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "analysis": {
      "analyzer": {
        "default": {
          "type": "standard",
          "stopwords": "_english_"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "title": { "type": "text", "analyzer": "standard", "boost": 3.0 },
      "content": { "type": "text", "analyzer": "standard" },
      "summary": { "type": "text", "boost": 2.0 },
      "keywords": { "type": "text", "boost": 1.5 },
      "embedding": { 
        "type": "dense_vector", 
        "dims": 768,
        "index": true,
        "similarity": "cosine"
      },
      "category": { "type": "keyword" },
      "department": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "date": { "type": "date" },
      "author": { "type": "keyword" }
    }
  }
}
```

## Performance Characteristics

### Search Performance
- **Average Query Time**: 50-150ms
- **P95 Latency**: < 300ms
- **Throughput**: 500 QPS (with autoscaling)
- **Index Size**: Supports 500M+ documents

### AI/ML Performance
- **Embedding Generation**: 20-50ms per query
- **Summarization**: 500-1500ms per response
- **Reranking**: 100-300ms for 10 documents

### Cost Optimization
- **Elasticsearch**: Shared cluster ~$100/month
- **Vertex AI**: Pay-per-use ~$50/month (10K queries)
- **Cloud Run**: Autoscaling $20/month
- **Total**: ~$170/month for 10K queries

## Security Architecture

```
┌─────────────────────────────────────────────┐
│  Security Layers                            │
├─────────────────────────────────────────────┤
│  1. Network Security                        │
│     - HTTPS/TLS 1.3 Encryption             │
│     - Cloud Run IAP (Optional)             │
│     - VPC Connector (Private Access)       │
├─────────────────────────────────────────────┤
│  2. Authentication & Authorization          │
│     - API Key Management (Secret Manager)  │
│     - IAM Roles & Permissions              │
│     - Service Account Authentication       │
├─────────────────────────────────────────────┤
│  3. Data Protection                         │
│     - Elasticsearch API Key Rotation       │
│     - No Data Logging (PII Protection)     │
│     - Encrypted Secrets                    │
├─────────────────────────────────────────────┤
│  4. Application Security                    │
│     - Input Validation                     │
│     - Rate Limiting                        │
│     - CORS Configuration                   │
│     - SQL/NoSQL Injection Prevention       │
└─────────────────────────────────────────────┘
```

## Scalability Strategy

### Horizontal Scaling
- **Cloud Run**: Auto-scales 0-1000 instances
- **Elasticsearch**: Cluster expansion (add nodes)
- **Vertex AI**: Serverless (automatic scaling)

### Vertical Scaling
- **Cloud Run**: Increase CPU/Memory per instance
- **Elasticsearch**: Use larger instance types

### Caching Strategy
- **Query Cache**: Elasticsearch built-in
- **Embedding Cache**: Redis (future enhancement)
- **CDN**: Static assets (Next.js)

## Monitoring & Observability

```
┌──────────────────────────────────────┐
│  Logging                             │
│  - Cloud Logging (structured logs)  │
│  - Request/Response logging         │
│  - Error tracking                   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Metrics                             │
│  - Query latency (p50, p95, p99)    │
│  - Search relevance scores          │
│  - AI/ML performance                │
│  - Resource utilization             │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Tracing                             │
│  - Cloud Trace (distributed)        │
│  - Request flow visualization       │
│  - Performance bottleneck detection │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Alerting                            │
│  - Error rate thresholds            │
│  - Latency SLA violations           │
│  - Cost anomalies                   │
└──────────────────────────────────────┘
```

## Future Enhancements

1. **Advanced RAG**
   - Multi-hop reasoning
   - Knowledge graph integration
   - Fact verification

2. **Enhanced Agents**
   - SQL query generation
   - Workflow automation
   - Proactive recommendations

3. **Performance**
   - Redis caching layer
   - Query result streaming
   - Batch processing

4. **Features**
   - Multi-language support
   - Voice interface
   - Mobile apps

5. **Enterprise**
   - SSO integration
   - Audit logging
   - Compliance reporting
