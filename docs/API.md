# API Documentation - Elastic Context Concierge

## Base URL
```
Production: https://gateway-xxxxx.run.app
Development: http://localhost:8080
```

## Authentication
API Key authentication (stored in Secret Manager)
```bash
Authorization: Bearer <API_KEY>
```

---

## Endpoints

### 1. Health Check
Check service health and connectivity

**GET** `/health`

#### Response
```json
{
  "status": "healthy",
  "elasticsearch": true,
  "mode": "production",
  "version": "2.0.0",
  "features": ["hybrid-search", "reranking", "multi-agent", "analytics"]
}
```

---

### 2. Hybrid Search
Perform hybrid search with BM25 + Vector + RRF

**POST** `/tool/search`

#### Request Body
```json
{
  "query": "What is the remote work policy?",
  "filters": {
    "category": ["HR", "Policy"],
    "department": ["People Operations"],
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    },
    "tags": ["remote", "hybrid"]
  },
  "topK": 5,
  "options": {
    "enableReranking": true,
    "includeAggregations": true,
    "rrfRankConstant": 60,
    "rrfWindowSize": 100
  }
}
```

#### Response
```json
{
  "results": [
    {
      "id": "doc_123",
      "title": "Remote Work Policy 2024",
      "content": "Employees may work remotely up to 3 days per week...",
      "summary": "Official remote work guidelines",
      "category": "HR",
      "department": "People Operations",
      "date": "2024-01-15",
      "tags": ["remote", "hybrid", "policy"],
      "author": "HR Team",
      "score": 15.342,
      "rank": 1,
      "rerankScore": 0.95,
      "combinedScore": 9.706
    }
  ],
  "totalHits": 47,
  "usedHybrid": true,
  "usedReranking": true,
  "aggregations": {
    "categories": [
      { "key": "HR", "doc_count": 25 },
      { "key": "Policy", "doc_count": 22 }
    ],
    "departments": [
      { "key": "People Operations", "doc_count": 30 }
    ],
    "tags": [
      { "key": "remote", "doc_count": 40 },
      { "key": "hybrid", "doc_count": 35 }
    ],
    "dateDistribution": [
      { "key_as_string": "2024-01-01", "doc_count": 15 }
    ]
  },
  "searchMetrics": {
    "queryTime": 145,
    "maxScore": 15.342,
    "rrfRankConstant": 60,
    "rrfWindowSize": 100
  }
}
```

---

### 3. Summarize Documents
Generate AI-powered summary with citations

**POST** `/tool/summarize`

#### Request Body
```json
{
  "chunks": [
    {
      "content": "Document content here...",
      "source": "Document Title",
      "id": "doc_123"
    }
  ],
  "style": "comprehensive"
}
```

**Styles**: `concise`, `comprehensive`, `bullet-points`

#### Response
```json
{
  "summary": "The remote work policy allows employees to work from home up to 3 days per week [1]. Office presence is required on Tuesdays and Thursdays [2].",
  "citations": [
    {
      "id": 1,
      "source": "Remote Work Policy 2024",
      "snippet": "work remotely up to 3 days per week"
    }
  ],
  "wordCount": 42,
  "generationTime": 850
}
```

---

### 4. Compare Documents
Side-by-side document comparison

**POST** `/tool/compare`

#### Request Body
```json
{
  "documents": [
    {
      "id": "doc_1",
      "title": "Q1 Report",
      "content": "Revenue increased by 15%...",
      "category": "Finance"
    },
    {
      "id": "doc_2",
      "title": "Q2 Report",
      "content": "Revenue increased by 22%...",
      "category": "Finance"
    }
  ],
  "options": {
    "includeMetadata": true,
    "highlightDifferences": true,
    "generateSummary": true
  }
}
```

#### Response
```json
{
  "documents": [
    {
      "id": "doc_1",
      "title": "Q1 Report",
      "keyPoints": [
        "Revenue increased 15%",
        "Customer base grew 10%",
        "New product launch successful"
      ],
      "metadata": {
        "category": "Finance",
        "date": "2024-04-01"
      }
    },
    {
      "id": "doc_2",
      "title": "Q2 Report",
      "keyPoints": [
        "Revenue increased 22%",
        "Customer base grew 18%",
        "Expansion into new markets"
      ]
    }
  ],
  "similarities": [
    "Both quarters showed revenue growth",
    "Customer acquisition remained strong"
  ],
  "differences": [
    "Q2 growth rate significantly higher (22% vs 15%)",
    "Q2 focused on market expansion"
  ],
  "uniqueAspects": [
    "Q1: New product launch",
    "Q2: International expansion"
  ],
  "summary": "Q2 outperformed Q1 with 47% higher revenue growth and stronger customer acquisition, driven by market expansion."
}
```

---

### 5. Analyze Documents
Deep analysis with sentiment, entities, topics

**POST** `/tool/analyze`

#### Request Body
```json
{
  "documents": [
    {
      "id": "doc_1",
      "title": "Customer Feedback Survey",
      "content": "Customers love our new features..."
    }
  ],
  "options": {
    "includeSentiment": true,
    "includeEntities": true,
    "includeTopics": true,
    "includeInsights": true
  }
}
```

#### Response
```json
{
  "documents": [
    {
      "id": "doc_1",
      "title": "Customer Feedback Survey",
      "sentiment": {
        "score": 0.75,
        "label": "positive",
        "explanation": "Overall positive feedback with enthusiasm for new features"
      },
      "entities": {
        "people": ["Sarah Johnson", "Mike Chen"],
        "organizations": ["Acme Corp"],
        "locations": ["New York", "San Francisco"],
        "technologies": ["AI Assistant", "Cloud Platform"],
        "products": ["Premium Plan", "Dashboard"]
      },
      "topics": [
        { "topic": "Product Features", "confidence": 0.92 },
        { "topic": "User Experience", "confidence": 0.85 },
        { "topic": "Customer Support", "confidence": 0.78 }
      ],
      "insights": {
        "keyTakeaways": [
          "Users highly value AI-powered features",
          "Dashboard usability is a key differentiator",
          "Support response time exceeds expectations"
        ],
        "recommendations": [
          "Expand AI capabilities based on positive reception",
          "Invest in dashboard enhancements",
          "Maintain current support quality standards"
        ],
        "implications": [
          "Strong product-market fit for AI features",
          "Potential for premium tier growth",
          "Customer satisfaction drives retention"
        ]
      }
    }
  ],
  "aggregate": {
    "totalDocuments": 1,
    "averageSentiment": 0.75,
    "topTopics": [
      { "topic": "Product Features", "frequency": 1 }
    ],
    "sentimentDistribution": {
      "positive": 1,
      "neutral": 0,
      "negative": 0
    }
  },
  "timestamp": "2024-10-21T10:30:00Z"
}
```

---

### 6. Citation Extraction
Extract and format citations from generated content

**POST** `/tool/cite`

#### Request Body
```json
{
  "searchResults": [
    {
      "id": "doc_1",
      "title": "Remote Work Policy",
      "content": "Employees can work remotely 3 days per week"
    }
  ],
  "generatedText": "The company allows remote work three days weekly.",
  "style": "inline"
}
```

**Styles**: `inline`, `footnote`, `endnote`

#### Response
```json
{
  "citations": [
    {
      "sourceId": "doc_1",
      "title": "Remote Work Policy",
      "snippet": "work remotely 3 days per week",
      "relevanceScore": 0.87
    }
  ],
  "formatted": "[1] Remote Work Policy - \"work remotely 3 days per week\"",
  "citedText": "The company allows remote work three days weekly [1].\n\n**Sources:**\n[1] Remote Work Policy\n    \"work remotely 3 days per week\"",
  "verification": {
    "isVerified": true,
    "citationCount": 1,
    "missingCitations": false,
    "warnings": []
  }
}
```

---

### 7. Agent Chat
Intelligent agent orchestration with multi-turn conversations

**POST** `/agent/chat`

#### Request Body
```json
{
  "message": "Compare the Q1 and Q2 financial reports",
  "history": [
    { "role": "user", "content": "Show me financial reports" },
    { "role": "assistant", "content": "I found 5 reports..." }
  ],
  "context": {
    "documents": [
      { "id": "q1_report", "title": "Q1 Report" },
      { "id": "q2_report", "title": "Q2 Report" }
    ],
    "filters": {
      "category": ["Finance"]
    }
  }
}
```

#### Response
```json
{
  "intent": "compare",
  "response": {
    "documents": [...],
    "similarities": [...],
    "differences": [...],
    "summary": "Q2 showed 30% improvement over Q1..."
  },
  "timestamp": "2024-10-21T10:30:00Z"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request parameters",
  "details": "At least 2 documents required for comparison"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to process request",
  "details": "Elasticsearch connection timeout"
}
```

### 503 Service Unavailable
```json
{
  "status": "unhealthy",
  "error": "Elasticsearch is not responding"
}
```

---

## Rate Limits
- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1000 requests/hour
- **Enterprise**: Unlimited

## Best Practices

1. **Use Filters**: Apply category/department filters to improve relevance
2. **Enable Reranking**: For critical queries, enable semantic reranking
3. **Batch Requests**: Use compare/analyze for multiple documents at once
4. **Cache Results**: Implement client-side caching for repeated queries
5. **Monitor Metrics**: Track queryTime and scores to optimize performance

## SDK Examples

### JavaScript/TypeScript
```typescript
const response = await fetch('https://gateway-xxxxx.run.app/tool/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    query: 'remote work policy',
    topK: 5,
    options: { enableReranking: true }
  })
});

const data = await response.json();
console.log(data.results);
```

### Python
```python
import requests

response = requests.post(
    'https://gateway-xxxxx.run.app/tool/search',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    json={
        'query': 'remote work policy',
        'topK': 5,
        'options': {'enableReranking': True}
    }
)

data = response.json()
print(data['results'])
```

### cURL
```bash
curl -X POST https://gateway-xxxxx.run.app/tool/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "query": "remote work policy",
    "topK": 5,
    "options": {"enableReranking": true}
  }'
```
