# 🚀 Complete Build & Test Guide

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Node.js 20+** installed (`node --version`)
- [ ] **npm 9+** or **yarn 1.22+**
- [ ] **Google Cloud account** with billing enabled
- [ ] **Elastic Cloud account** (free trial available)
- [ ] **Terraform 1.5+** (`terraform --version`)
- [ ] **gcloud CLI** installed and authenticated
- [ ] **Git** for version control

---

## Step 1: Local Development Setup

### 1.1 Clone and Install Dependencies

```powershell
# Clone the repository
git clone https://github.com/yourusername/elastic-context-concierge.git
cd elastic-context-concierge

# Install root dependencies
npm install

# Install gateway service dependencies
cd services/gateway
npm install
cd ../..

# Install web app dependencies
cd web
npm install
cd ..
```

### 1.2 Configure Environment Variables

Create `.env` files for each service:

**services/gateway/.env:**
```bash
# Elasticsearch Configuration
ELASTICSEARCH_URL=https://your-cluster.es.us-central1.gcp.cloud.es.io
ELASTICSEARCH_API_KEY=your_api_key_here

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
VERTEX_AI_LOCATION=us-central1

# Server Configuration
PORT=8080
NODE_ENV=development

# Optional: Enable mock mode for testing without external services
MOCK=false
```

**web/.env.local:**
```bash
# Gateway Service URL
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080
GATEWAY_SERVICE_URL=http://localhost:8080

# Optional
NEXT_PUBLIC_APP_NAME=Elastic Context Concierge
```

### 1.3 Setup Elasticsearch Index

Create the Elasticsearch index with proper mappings:

```powershell
# Install Elasticsearch client globally
npm install -g @elastic/elasticsearch

# Run index setup script (create this script)
node scripts/setup-index.js
```

**scripts/setup-index.js:**
```javascript
const { Client } = require('@elastic/elasticsearch');

const client = new Client({
  node: process.env.ELASTICSEARCH_URL,
  auth: { apiKey: process.env.ELASTICSEARCH_API_KEY }
});

async function setupIndex() {
  const indexName = 'enterprise_docs';
  
  // Create index with mappings
  await client.indices.create({
    index: indexName,
    body: {
      settings: {
        number_of_shards: 3,
        number_of_replicas: 1
      },
      mappings: {
        properties: {
          title: { type: 'text', boost: 3.0 },
          content: { type: 'text' },
          summary: { type: 'text', boost: 2.0 },
          keywords: { type: 'text', boost: 1.5 },
          embedding: {
            type: 'dense_vector',
            dims: 768,
            index: true,
            similarity: 'cosine'
          },
          category: { type: 'keyword' },
          department: { type: 'keyword' },
          tags: { type: 'keyword' },
          date: { type: 'date' },
          author: { type: 'keyword' }
        }
      }
    }
  });

  console.log(`Index ${indexName} created successfully!`);
}

setupIndex().catch(console.error);
```

---

## Step 2: Run Tests

### 2.1 Gateway Service Tests

```powershell
cd services/gateway

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- search.test.ts

# Watch mode for development
npm run test:watch
```

Expected output:
```
PASS  src/tools/__tests__/search.test.ts
PASS  src/tools/__tests__/compare.test.ts
PASS  src/tools/__tests__/cite.test.ts

Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total
Coverage:    85.3% statements
```

### 2.2 Lint and Format

```powershell
# Lint TypeScript code
npm run lint

# Auto-fix lint issues
npm run lint --fix

# Format code with Prettier
npm run format
```

---

## Step 3: Local Development

### 3.1 Start Gateway Service

```powershell
cd services/gateway
npm run dev
```

Expected output:
```
Gateway service listening on port 8080
Mode: REAL
Available tools: search, summarize, compare, analyze, cite
```

Test the health endpoint:
```powershell
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "elasticsearch": true,
  "mode": "production",
  "version": "2.0.0",
  "features": ["hybrid-search", "reranking", "multi-agent", "analytics"]
}
```

### 3.2 Start Web Application

```powershell
# In a new terminal
cd web
npm run dev
```

Expected output:
```
▲ Next.js 14.0.0
- Local:        http://localhost:3000
- Ready in 1.2s
```

Open http://localhost:3000 in your browser.

---

## Step 4: Ingest Sample Data

### 4.1 Prepare Sample Documents

Create sample documents in `data/samples/sample-documents.json`:

```json
[
  {
    "title": "Remote Work Policy 2024",
    "content": "Employees may work remotely up to 3 days per week...",
    "summary": "Official remote work guidelines",
    "category": "HR",
    "department": "People Operations",
    "tags": ["remote", "hybrid", "policy"],
    "date": "2024-01-15",
    "author": "HR Team"
  }
]
```

### 4.2 Run Ingestion Script

```powershell
cd ingestion
npm install
node ingest.js --source ../data/samples/sample-documents.json
```

Expected output:
```
Ingesting documents from ../data/samples/sample-documents.json
✓ Embedded 25 documents
✓ Indexed 25 documents to Elasticsearch
✓ Ingestion complete in 12.5s
```

---

## Step 5: Manual Testing

### 5.1 Test Search API

```powershell
curl -X POST http://localhost:8080/tool/search `
  -H "Content-Type: application/json" `
  -d '{
    "query": "remote work policy",
    "topK": 5,
    "options": {
      "enableReranking": true,
      "includeAggregations": true
    }
  }'
```

### 5.2 Test Summarization

```powershell
curl -X POST http://localhost:8080/tool/summarize `
  -H "Content-Type: application/json" `
  -d '{
    "chunks": [
      {
        "content": "Test content here",
        "source": "Test Doc"
      }
    ],
    "style": "comprehensive"
  }'
```

### 5.3 Test Web UI

1. Open http://localhost:3000
2. Try example queries:
   - "What is the remote work policy?"
   - "Summarize the product release notes"
   - "Compare Q1 and Q2 reports"
3. Apply filters (category, department)
4. Check citation sources

---

## Step 6: Build for Production

### 6.1 Build Gateway Service

```powershell
cd services/gateway
npm run build
```

Output: `dist/` folder with compiled JavaScript

### 6.2 Build Web Application

```powershell
cd web
npm run build
```

Output: `.next/` folder with optimized production build

### 6.3 Test Production Builds Locally

```powershell
# Gateway
cd services/gateway
npm start

# Web (in new terminal)
cd web
npm start
```

---

## Step 7: Deploy to Google Cloud

### 7.1 Authenticate with Google Cloud

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 7.2 Deploy Infrastructure

```powershell
cd infra

# Initialize Terraform
terraform init

# Plan deployment
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan
```

This creates:
- Cloud Run services (gateway, web)
- Secret Manager secrets
- IAM roles and permissions
- VPC connector (optional)

### 7.3 Deploy Gateway Service

```powershell
cd services/gateway

# Build Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/gateway

# Deploy to Cloud Run
gcloud run deploy gateway `
  --image gcr.io/YOUR_PROJECT_ID/gateway `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated
```

### 7.4 Deploy Web Application

```powershell
cd web

# Build Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/web

# Deploy to Cloud Run
gcloud run deploy web `
  --image gcr.io/YOUR_PROJECT_ID/web `
  --platform managed `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars GATEWAY_SERVICE_URL=https://gateway-xxxxx.run.app
```

---

## Step 8: End-to-End Testing

### 8.1 Test Deployed Gateway

```powershell
# Get gateway URL
$GATEWAY_URL = gcloud run services describe gateway --region us-central1 --format 'value(status.url)'

# Test health
curl "$GATEWAY_URL/health"

# Test search
curl -X POST "$GATEWAY_URL/tool/search" `
  -H "Content-Type: application/json" `
  -d '{"query": "test", "topK": 3}'
```

### 8.2 Test Deployed Web App

```powershell
# Get web app URL
$WEB_URL = gcloud run services describe web --region us-central1 --format 'value(status.url)'

# Open in browser
Start-Process $WEB_URL
```

### 8.3 Performance Testing

```powershell
# Install Apache Bench (comes with Apache HTTP Server)
# Or use hey: https://github.com/rakyll/hey

# Test search endpoint
ab -n 100 -c 10 -p search.json -T application/json "$GATEWAY_URL/tool/search"

# Expected results:
# - Requests per second: > 50
# - Mean time: < 300ms
# - p95: < 500ms
```

---

## Step 9: Monitoring & Validation

### 9.1 Check Metrics Dashboard

```powershell
curl "$GATEWAY_URL/metrics/dashboard"
```

Expected metrics:
```json
{
  "overview": {
    "status": "healthy",
    "uptime": "2h 15m",
    "totalRequests": 1250,
    "errorRate": "0.12%"
  },
  "search": {
    "avgLatency": "145ms",
    "p95Latency": "280ms",
    "hybridSearchRate": "100.0%"
  }
}
```

### 9.2 View Cloud Logs

```powershell
# Gateway logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gateway" --limit 50 --format json

# Web app logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=web" --limit 50 --format json
```

### 9.3 Monitor Cloud Run Metrics

View in Google Cloud Console:
- Cloud Run → gateway → Metrics
- Check: Request count, latency, error rate, CPU usage

---

## Step 10: Troubleshooting

### Common Issues

**Issue: "Cannot connect to Elasticsearch"**
```powershell
# Check Elasticsearch URL and API key
curl -H "Authorization: ApiKey YOUR_API_KEY" YOUR_ELASTICSEARCH_URL

# Verify environment variables are set
echo $env:ELASTICSEARCH_URL
```

**Issue: "Vertex AI authentication failed"**
```powershell
# Check Google Cloud authentication
gcloud auth application-default login

# Verify project is set
gcloud config get-value project
```

**Issue: "Tests failing"**
```powershell
# Clear node_modules and reinstall
rm -r node_modules
rm package-lock.json
npm install

# Reset test environment
npm run test -- --clearCache
```

**Issue: "Deployment failed"**
```powershell
# Check Cloud Build logs
gcloud builds list --limit 5

# View specific build logs
gcloud builds log BUILD_ID

# Check Cloud Run logs
gcloud run services logs read gateway --limit 100
```

---

## Step 11: Validation Checklist

- [ ] All unit tests passing (>80% coverage)
- [ ] Gateway health endpoint returns "healthy"
- [ ] Search returns results with citations
- [ ] Filters work correctly (category, department, date)
- [ ] Aggregations display in UI
- [ ] Summarization generates accurate answers
- [ ] Citations link to correct sources
- [ ] Compare tool works for 2+ documents
- [ ] Analyze tool extracts sentiment/entities
- [ ] Metrics dashboard shows data
- [ ] Deployment successful (both services)
- [ ] Production URLs accessible
- [ ] Performance meets targets (p95 < 300ms)
- [ ] No errors in Cloud Logs

---

## Performance Targets

| Metric | Target | Validation |
|--------|--------|------------|
| Search Latency (p95) | < 300ms | `curl /metrics/search` |
| AI Summarization | < 2s | `curl /metrics/ai` |
| Error Rate | < 1% | `curl /metrics/system` |
| Uptime | > 99.9% | Cloud Run metrics |
| Concurrent Users | 1,000+ | Load testing |

---

## Next Steps

1. **Create Demo Video**: Record 3-minute walkthrough
2. **Update GitHub**: Push all changes, update README
3. **Prepare Submission**: Complete HACKATHON_SUBMISSION.md
4. **Test Live Demo**: Share URL with team for feedback
5. **Submit to Hackathon**: Follow official submission process

---

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review documentation in `docs/`
3. Check GitHub issues
4. Contact: [your email]

---

**Good luck with your Elastic Challenge submission! 🚀**
