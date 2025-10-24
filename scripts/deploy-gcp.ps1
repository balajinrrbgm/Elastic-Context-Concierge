# Complete GCP Deployment Script for Elastic Context Concierge
# No Terraform - Pure gcloud CLI deployment
# Optimized for GCP Free Tier

# Exit on any error
$ErrorActionPreference = "Stop"

Write-Host "🚀 Elastic Context Concierge - GCP Deployment Script" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Step 1: Set GCP Project
Write-Host "`n📋 Step 1: Configure GCP Project" -ForegroundColor Yellow
$PROJECT_ID = Read-Host "Enter your GCP Project ID"
gcloud config set project $PROJECT_ID

# Verify billing is enabled
Write-Host "Checking billing status..." -ForegroundColor Gray
$BILLING_ENABLED = gcloud beta billing projects describe $PROJECT_ID --format="value(billingEnabled)"
if ($BILLING_ENABLED -ne "True") {
    Write-Host "❌ Billing is not enabled on this project. Please enable billing first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Billing enabled" -ForegroundColor Green

# Step 2: Enable Required APIs (Free Tier Compatible)
Write-Host "`n📋 Step 2: Enabling Required GCP APIs" -ForegroundColor Yellow
$REQUIRED_APIS = @(
    "run.googleapis.com",                    # Cloud Run (Free tier: 2M requests/month)
    "cloudbuild.googleapis.com",              # Cloud Build (Free tier: 120 build-minutes/day)
    "aiplatform.googleapis.com",              # Vertex AI (Pay-per-use, minimal cost)
    "secretmanager.googleapis.com",           # Secret Manager (Free tier: 6 secrets)
    "artifactregistry.googleapis.com"         # Artifact Registry (Free tier: 0.5GB)
)

foreach ($API in $REQUIRED_APIS) {
    Write-Host "Enabling $API..." -ForegroundColor Gray
    gcloud services enable $API --quiet
}
Write-Host "✅ All required APIs enabled" -ForegroundColor Green

# Step 3: Get Elasticsearch from GCP Marketplace
Write-Host "`n📋 Step 3: Elasticsearch Setup" -ForegroundColor Yellow
Write-Host @"
Please complete Elasticsearch setup manually:

1. Go to GCP Marketplace: https://console.cloud.google.com/marketplace
2. Search for "Elastic Cloud"
3. Click "Subscribe" or "Enable"
4. Choose deployment options:
   - Region: us-central1 (same as Vertex AI)
   - Deployment Type: "Serverless" (recommended, auto-scales)
   - OR "Standard" with smallest size (1GB RAM, 0.5 vCPU)
   
5. After deployment, get your:
   - Elasticsearch URL (endpoint)
   - API Key (from Elasticsearch console)

IMPORTANT FOR COST SAVINGS:
- Use Serverless (pay only for actual usage)
- OR use smallest Standard deployment ($0.10/hour = ~$73/month)
- Elastic offers 14-day free trial
- Can delete after hackathon to avoid charges

"@ -ForegroundColor Cyan

$ES_URL = Read-Host "`nEnter your Elasticsearch URL (e.g., https://xxxx.es.us-central1.gcp.cloud.es.io:443)"
$ES_API_KEY = Read-Host "Enter your Elasticsearch API Key"

# Validate Elasticsearch connection
Write-Host "Testing Elasticsearch connection..." -ForegroundColor Gray
try {
    $headers = @{
        "Authorization" = "ApiKey $ES_API_KEY"
        "Content-Type" = "application/json"
    }
    $response = Invoke-RestMethod -Uri "$ES_URL/_cluster/health" -Headers $headers -Method Get
    Write-Host "✅ Elasticsearch connection successful!" -ForegroundColor Green
    Write-Host "   Cluster: $($response.cluster_name), Status: $($response.status)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to connect to Elasticsearch. Please check your URL and API Key." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Create Secrets in Secret Manager
Write-Host "`n📋 Step 4: Creating Secrets" -ForegroundColor Yellow

# Delete existing secrets if they exist
Write-Host "Cleaning up old secrets..." -ForegroundColor Gray
gcloud secrets delete elasticsearch-url --quiet 2>$null
gcloud secrets delete elasticsearch-api-key --quiet 2>$null

# Create new secrets
Write-Host "Creating elasticsearch-url secret..." -ForegroundColor Gray
echo $ES_URL | gcloud secrets create elasticsearch-url --data-file=- --replication-policy=automatic

Write-Host "Creating elasticsearch-api-key secret..." -ForegroundColor Gray
echo $ES_API_KEY | gcloud secrets create elasticsearch-api-key --data-file=- --replication-policy=automatic

Write-Host "✅ Secrets created successfully" -ForegroundColor Green

# Step 5: Setup Elasticsearch Index
Write-Host "`n📋 Step 5: Creating Elasticsearch Index" -ForegroundColor Yellow

$INDEX_CONFIG = @{
    settings = @{
        number_of_shards = 1        # Minimize cost
        number_of_replicas = 0       # No replicas for demo (cost saving)
    }
    mappings = @{
        properties = @{
            title = @{
                type = "text"
                boost = 3.0
            }
            content = @{
                type = "text"
            }
            summary = @{
                type = "text"
                boost = 2.0
            }
            embedding = @{
                type = "dense_vector"
                dims = 768
                index = $true
                similarity = "cosine"
            }
            category = @{ type = "keyword" }
            department = @{ type = "keyword" }
            tags = @{ type = "keyword" }
            date = @{ type = "date" }
            author = @{ type = "keyword" }
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "Creating 'enterprise_docs' index..." -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$ES_URL/enterprise_docs" -Headers $headers -Method Put -Body $INDEX_CONFIG
    Write-Host "✅ Index created successfully!" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "⚠️ Index already exists, skipping..." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Failed to create index: $_" -ForegroundColor Red
        exit 1
    }
}

# Step 6: Create Service Account for Cloud Run
Write-Host "`n📋 Step 6: Creating Service Account" -ForegroundColor Yellow
$SA_NAME = "elastic-concierge-sa"
$SA_EMAIL = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Create service account
Write-Host "Creating service account..." -ForegroundColor Gray
gcloud iam service-accounts create $SA_NAME `
    --display-name="Elastic Concierge Service Account" `
    --quiet 2>$null

# Grant permissions (minimal for cost)
Write-Host "Granting permissions..." -ForegroundColor Gray
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/aiplatform.user" `
    --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/secretmanager.secretAccessor" `
    --quiet

Write-Host "✅ Service account configured" -ForegroundColor Green

# Step 7: Build Gateway Service Container
Write-Host "`n📋 Step 7: Building Gateway Service" -ForegroundColor Yellow
Write-Host "Building container image with Cloud Build..." -ForegroundColor Gray

Set-Location "services\gateway"

# Create .gcloudignore if not exists
if (-not (Test-Path ".gcloudignore")) {
    @"
node_modules/
npm-debug.log
.env
.git/
.gitignore
*.md
__tests__/
*.test.ts
"@ | Out-File -FilePath ".gcloudignore" -Encoding utf8
}

# Build and push to Artifact Registry (not GCR - deprecated)
$REGION = "us-central1"
$IMAGE_NAME = "elastic-gateway"
$IMAGE_URI = "$REGION-docker.pkg.dev/$PROJECT_ID/elastic-concierge/$IMAGE_NAME"

# Create Artifact Registry repository
Write-Host "Creating Artifact Registry repository..." -ForegroundColor Gray
gcloud artifacts repositories create elastic-concierge `
    --repository-format=docker `
    --location=$REGION `
    --description="Elastic Concierge Images" `
    --quiet 2>$null

# Submit build
Write-Host "Submitting build (this may take 3-5 minutes)..." -ForegroundColor Gray
gcloud builds submit --tag $IMAGE_URI --quiet

Write-Host "✅ Gateway image built successfully" -ForegroundColor Green

Set-Location "..\..\"

# Step 8: Deploy Gateway to Cloud Run
Write-Host "`n📋 Step 8: Deploying Gateway Service to Cloud Run" -ForegroundColor Yellow

$GATEWAY_SERVICE = "elastic-gateway"

gcloud run deploy $GATEWAY_SERVICE `
    --image=$IMAGE_URI `
    --platform=managed `
    --region=$REGION `
    --allow-unauthenticated `
    --service-account=$SA_EMAIL `
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,VERTEX_AI_LOCATION=$REGION" `
    --set-secrets="ELASTICSEARCH_URL=elasticsearch-url:latest,ELASTICSEARCH_API_KEY=elasticsearch-api-key:latest" `
    --memory=512Mi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=3 `
    --timeout=60s `
    --quiet

# Get Gateway URL
$GATEWAY_URL = gcloud run services describe $GATEWAY_SERVICE --region=$REGION --format="value(status.url)"
Write-Host "✅ Gateway deployed at: $GATEWAY_URL" -ForegroundColor Green

# Test Gateway
Write-Host "Testing gateway health..." -ForegroundColor Gray
try {
    $health = Invoke-RestMethod -Uri "$GATEWAY_URL/health" -Method Get
    Write-Host "✅ Gateway is healthy!" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️ Gateway health check failed. Check logs with:" -ForegroundColor Yellow
    Write-Host "   gcloud run services logs read $GATEWAY_SERVICE --region=$REGION" -ForegroundColor Gray
}

# Step 9: Build and Deploy Web App
Write-Host "`n📋 Step 9: Building Web Application" -ForegroundColor Yellow

Set-Location "web"

# Create web .gcloudignore
if (-not (Test-Path ".gcloudignore")) {
    @"
node_modules/
.next/
npm-debug.log
.env*
.git/
.gitignore
*.md
"@ | Out-File -FilePath ".gcloudignore" -Encoding utf8
}

$WEB_IMAGE_URI = "$REGION-docker.pkg.dev/$PROJECT_ID/elastic-concierge/elastic-web"

Write-Host "Building web app container..." -ForegroundColor Gray
gcloud builds submit --tag $WEB_IMAGE_URI --quiet

Write-Host "✅ Web app image built" -ForegroundColor Green

# Deploy Web App
Write-Host "Deploying web app to Cloud Run..." -ForegroundColor Gray

$WEB_SERVICE = "elastic-web"

gcloud run deploy $WEB_SERVICE `
    --image=$WEB_IMAGE_URI `
    --platform=managed `
    --region=$REGION `
    --allow-unauthenticated `
    --set-env-vars="NEXT_PUBLIC_GATEWAY_URL=$GATEWAY_URL,GATEWAY_SERVICE_URL=$GATEWAY_URL" `
    --memory=512Mi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=3 `
    --timeout=60s `
    --quiet

$WEB_URL = gcloud run services describe $WEB_SERVICE --region=$REGION --format="value(status.url)"

Set-Location ".."

Write-Host "✅ Web app deployed at: $WEB_URL" -ForegroundColor Green

# Step 10: Ingest Sample Data
Write-Host "`n📋 Step 10: Ingesting Sample Data" -ForegroundColor Yellow
Write-Host "This will populate your Elasticsearch index with sample documents" -ForegroundColor Gray

$INGEST_CHOICE = Read-Host "Do you want to ingest sample data now? (y/n)"
if ($INGEST_CHOICE -eq "y") {
    Set-Location "ingestion"
    npm install
    
    # Set environment variables for ingestion
    $env:ELASTICSEARCH_URL = $ES_URL
    $env:ELASTICSEARCH_API_KEY = $ES_API_KEY
    $env:GOOGLE_CLOUD_PROJECT = $PROJECT_ID
    $env:VERTEX_AI_LOCATION = $REGION
    
    node ingest.js --source ../data/samples/sample-documents.txt
    
    Set-Location ".."
    Write-Host "✅ Sample data ingested" -ForegroundColor Green
}

# Step 11: Create .env file with actual values
Write-Host "`n📋 Step 11: Updating .env Configuration" -ForegroundColor Yellow

$ENV_CONTENT = @"
# Elasticsearch Configuration (GCP Marketplace)
ELASTICSEARCH_URL=$ES_URL
ELASTICSEARCH_API_KEY=$ES_API_KEY

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=$PROJECT_ID
GOOGLE_CLOUD_REGION=$REGION
VERTEX_AI_LOCATION=$REGION

# Vertex AI Models (Hackathon Optimized)
VERTEX_EMBEDDING_MODEL=text-embedding-004
VERTEX_LLM_MODEL=gemini-2.0-flash-001

# Deployed Services
GATEWAY_SERVICE_URL=$GATEWAY_URL
NEXT_PUBLIC_GATEWAY_URL=$GATEWAY_URL

# Application
NODE_ENV=production
PORT=8080

# Cost Optimization
MIN_INSTANCES=0
MAX_INSTANCES=3
MEMORY_LIMIT=512Mi
CPU_LIMIT=1
"@

$ENV_CONTENT | Out-File -FilePath ".env" -Encoding utf8
$ENV_CONTENT | Out-File -FilePath "services\gateway\.env" -Encoding utf8
$ENV_CONTENT | Out-File -FilePath "web\.env.local" -Encoding utf8

Write-Host "✅ Environment files updated" -ForegroundColor Green

# Step 12: Display Summary
Write-Host "`n" -ForegroundColor White
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Deployment Summary:" -ForegroundColor Yellow
Write-Host "   Project ID:     $PROJECT_ID" -ForegroundColor White
Write-Host "   Region:         $REGION" -ForegroundColor White
Write-Host "   Gateway URL:    $GATEWAY_URL" -ForegroundColor Green
Write-Host "   Web App URL:    $WEB_URL" -ForegroundColor Green
Write-Host "   Elasticsearch:  $ES_URL" -ForegroundColor White
Write-Host ""
Write-Host "💰 Estimated Monthly Costs (GCP Free Tier):" -ForegroundColor Yellow
Write-Host "   Cloud Run:           $0 (2M requests free)" -ForegroundColor White
Write-Host "   Cloud Build:         $0 (120 min/day free)" -ForegroundColor White
Write-Host "   Secret Manager:      $0 (6 secrets free)" -ForegroundColor White
Write-Host "   Artifact Registry:   $0 (0.5GB free)" -ForegroundColor White
Write-Host "   Vertex AI:           ~$2-5 (pay-per-use)" -ForegroundColor White
Write-Host "   Elasticsearch:       $0-73 (trial or paid)" -ForegroundColor Yellow
Write-Host "   ------------------------------------------" -ForegroundColor White
Write-Host "   TOTAL:               ~$2-78/month" -ForegroundColor Green
Write-Host ""
Write-Host "🧪 Test Your Deployment:" -ForegroundColor Yellow
Write-Host "   curl $GATEWAY_URL/health" -ForegroundColor White
Write-Host "   curl $GATEWAY_URL/metrics/dashboard" -ForegroundColor White
Write-Host "   Start-Process $WEB_URL" -ForegroundColor White
Write-Host ""
Write-Host "📚 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Open web app: $WEB_URL" -ForegroundColor White
Write-Host "   2. Try example queries" -ForegroundColor White
Write-Host "   3. Check hackathon requirements (see validation script)" -ForegroundColor White
Write-Host "   4. Create demo video" -ForegroundColor White
Write-Host "   5. Submit to hackathon!" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Useful Commands:" -ForegroundColor Yellow
Write-Host "   View Gateway logs:  gcloud run services logs read $GATEWAY_SERVICE --region=$REGION" -ForegroundColor White
Write-Host "   View Web logs:      gcloud run services logs read $WEB_SERVICE --region=$REGION" -ForegroundColor White
Write-Host "   Update Gateway:     .\scripts\update-gateway.ps1" -ForegroundColor White
Write-Host "   Cleanup:            .\scripts\cleanup.ps1" -ForegroundColor White
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
