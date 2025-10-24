# ELASTIC CONTEXT CONCIERGE - CLOUD-ONLY DEPLOYMENT
# Competition deployment for $12,500 first place prize

param(
    [string]$ProjectId = "526997778957",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

Write-Host "ELASTIC CONTEXT CONCIERGE - CLOUD DEPLOYMENT" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "Target: 12500 USD First Place - Elastic AI Accelerate Hackathon" -ForegroundColor Yellow
Write-Host ""

# STEP 1: Set project
Write-Host "STEP 1: Set GCP Project" -ForegroundColor Yellow
Write-Host "=======================" -ForegroundColor Yellow

Write-Host "   Setting project to: $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId

$currentProject = gcloud config get-value project
Write-Host "   Current project: $currentProject" -ForegroundColor Green

# STEP 2: Elasticsearch Setup Guide
Write-Host ""
Write-Host "STEP 2: Elasticsearch from GCP Marketplace" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow

Write-Host "   Please set up Elasticsearch in GCP Console:" -ForegroundColor Magenta
Write-Host ""
Write-Host "   1. Open: https://console.cloud.google.com/marketplace/product/elastic-co/elastic-cloud" -ForegroundColor White
Write-Host "   2. Click GET STARTED then Try for free" -ForegroundColor White
Write-Host "   3. Choose Elasticsearch Serverless (14-day trial)" -ForegroundColor Green
Write-Host "   4. Region: us-central1" -ForegroundColor White
Write-Host "   5. Click Create deployment" -ForegroundColor White
Write-Host ""
Write-Host "   After deployment, collect these details:" -ForegroundColor Cyan
Write-Host "      Endpoint URL (e.g., https://abc123.es.us-central1.gcp.cloud.es.io:443)" -ForegroundColor Gray
Write-Host "      API Key (from Elasticsearch Console > Stack Management > API Keys)" -ForegroundColor Gray
Write-Host ""

$ElasticsearchUrl = Read-Host "   Enter Elasticsearch Endpoint URL"
$ElasticsearchApiKey = Read-Host "   Enter Elasticsearch API Key"

# Test connection
Write-Host "   Testing Elasticsearch connection..." -ForegroundColor Cyan
try {
    $headers = @{
        "Authorization" = "ApiKey $ElasticsearchApiKey"
        "Content-Type" = "application/json"
    }
    $health = Invoke-RestMethod -Uri "$ElasticsearchUrl/_cluster/health" -Headers $headers -TimeoutSec 10
    Write-Host "   Connected: $($health.cluster_name) ($($health.status))" -ForegroundColor Green
} catch {
    Write-Host "   Connection test failed, but continuing..." -ForegroundColor Yellow
}

# STEP 3: Enable APIs
Write-Host ""
Write-Host "STEP 3: Enable Required APIs" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow

$apis = @(
    "run.googleapis.com",
    "cloudbuild.googleapis.com", 
    "aiplatform.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com"
)

Write-Host "   Enabling APIs..." -ForegroundColor Cyan
foreach ($api in $apis) {
    Write-Host "      -> $api" -ForegroundColor Gray
    gcloud services enable $api --project=$ProjectId
}
Write-Host "   APIs enabled" -ForegroundColor Green

# STEP 4: Store Secrets
Write-Host ""
Write-Host "STEP 4: Store Secrets" -ForegroundColor Yellow
Write-Host "====================" -ForegroundColor Yellow

Write-Host "   Creating secrets..." -ForegroundColor Cyan

# Create secrets
try {
    Write-Output $ElasticsearchUrl | gcloud secrets create elasticsearch-url --data-file=- --project=$ProjectId 2>$null
    Write-Host "   elasticsearch-url created" -ForegroundColor Green
} catch {
    Write-Output $ElasticsearchUrl | gcloud secrets versions add elasticsearch-url --data-file=- --project=$ProjectId
    Write-Host "   elasticsearch-url updated" -ForegroundColor Green
}

try {
    Write-Output $ElasticsearchApiKey | gcloud secrets create elasticsearch-api-key --data-file=- --project=$ProjectId 2>$null
    Write-Host "   elasticsearch-api-key created" -ForegroundColor Green
} catch {
    Write-Output $ElasticsearchApiKey | gcloud secrets versions add elasticsearch-api-key --data-file=- --project=$ProjectId
    Write-Host "   elasticsearch-api-key updated" -ForegroundColor Green
}

# STEP 5: Create Index
Write-Host ""
Write-Host "STEP 5: Setup Elasticsearch Index" -ForegroundColor Yellow
Write-Host "==================================" -ForegroundColor Yellow

Write-Host "   Creating enterprise_docs index..." -ForegroundColor Cyan

$indexMapping = @{
    mappings = @{
        properties = @{
            title = @{ type = "text"; analyzer = "standard" }
            content = @{ type = "text"; analyzer = "standard" }
            category = @{ type = "keyword" }
            department = @{ type = "keyword" }
            tags = @{ type = "keyword" }
            author = @{ type = "keyword" }
            last_updated = @{ type = "date"; format = "yyyy-MM-dd" }
            embedding = @{
                type = "dense_vector"
                dims = 768
                index = $true
                similarity = "cosine"
            }
        }
    }
    settings = @{
        number_of_shards = 1
        number_of_replicas = 0
        "index.mapping.total_fields.limit" = 2000
    }
}

try {
    $indexJson = $indexMapping | ConvertTo-Json -Depth 10
    Invoke-RestMethod -Uri "$ElasticsearchUrl/enterprise_docs" -Method Put -Body $indexJson -Headers $headers | Out-Null
    Write-Host "   Index created" -ForegroundColor Green
} catch {
    Write-Host "   Index might already exist" -ForegroundColor Yellow
}

# STEP 6: Service Account
Write-Host ""
Write-Host "STEP 6: Create Service Account" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Yellow

$serviceAccountName = "elastic-concierge-sa"
$serviceAccountEmail = "$serviceAccountName@$ProjectId.iam.gserviceaccount.com"

Write-Host "   Creating service account..." -ForegroundColor Cyan
try {
    gcloud iam service-accounts create $serviceAccountName --display-name="Elastic Concierge SA" --project=$ProjectId 2>$null
    Write-Host "   Service account created" -ForegroundColor Green
} catch {
    Write-Host "   Service account exists" -ForegroundColor Yellow
}

# Assign roles
$roles = @("roles/aiplatform.user", "roles/secretmanager.secretAccessor")
foreach ($role in $roles) {
    gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$serviceAccountEmail" --role=$role --quiet
}
Write-Host "   IAM roles assigned" -ForegroundColor Green

# STEP 7: Container Registry
Write-Host ""
Write-Host "STEP 7: Setup Container Registry" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Yellow

$repositoryName = "elastic-concierge"

Write-Host "   Creating repository..." -ForegroundColor Cyan
try {
    gcloud artifacts repositories create $repositoryName --repository-format=docker --location=$Region --project=$ProjectId 2>$null
    Write-Host "   Repository created" -ForegroundColor Green
} catch {
    Write-Host "   Repository exists" -ForegroundColor Yellow
}

# STEP 8: Build and Deploy (Cloud Build only)
Write-Host ""
Write-Host "STEP 8: Build and Deploy Services" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow

$gatewayImage = "$Region-docker.pkg.dev/$ProjectId/$repositoryName/gateway:latest"
$webImage = "$Region-docker.pkg.dev/$ProjectId/$repositoryName/web:latest"

# Build Gateway using Cloud Build
Write-Host "   Building gateway service with Cloud Build..." -ForegroundColor Cyan
Set-Location "services/gateway"
gcloud builds submit --tag $gatewayImage --project=$ProjectId
Write-Host "   Gateway built" -ForegroundColor Green
Set-Location "../../"

# Build Web using Cloud Build
Write-Host "   Building web service with Cloud Build..." -ForegroundColor Cyan  
Set-Location "web"
gcloud builds submit --tag $webImage --project=$ProjectId
Write-Host "   Web built" -ForegroundColor Green
Set-Location "../"

# Deploy Gateway
Write-Host "   Deploying gateway to Cloud Run..." -ForegroundColor Cyan
$gatewayUrl = gcloud run deploy elastic-gateway `
    --image=$gatewayImage `
    --platform=managed `
    --region=$Region `
    --project=$ProjectId `
    --allow-unauthenticated `
    --service-account=$serviceAccountEmail `
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$ProjectId,GOOGLE_CLOUD_REGION=$Region,VERTEX_AI_LOCATION=$Region,NODE_ENV=production,PORT=8080" `
    --set-secrets="ELASTICSEARCH_URL=elasticsearch-url:latest,ELASTICSEARCH_API_KEY=elasticsearch-api-key:latest" `
    --memory=512Mi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=3 `
    --timeout=60s `
    --format="value(status.url)"

Write-Host "   Gateway deployed: $gatewayUrl" -ForegroundColor Green

# Deploy Web
Write-Host "   Deploying web to Cloud Run..." -ForegroundColor Cyan
$webUrl = gcloud run deploy elastic-web `
    --image=$webImage `
    --platform=managed `
    --region=$Region `
    --project=$ProjectId `
    --allow-unauthenticated `
    --set-env-vars="NEXT_PUBLIC_GATEWAY_URL=$gatewayUrl,NODE_ENV=production,PORT=3000" `
    --memory=512Mi `
    --cpu=1 `
    --min-instances=0 `
    --max-instances=3 `
    --timeout=60s `
    --format="value(status.url)"

Write-Host "   Web deployed: $webUrl" -ForegroundColor Green

# STEP 9: Load Sample Data
Write-Host ""
Write-Host "STEP 9: Load Sample Data" -ForegroundColor Yellow
Write-Host "========================" -ForegroundColor Yellow

Write-Host "   Adding demo documents..." -ForegroundColor Cyan

$sampleDocs = @(
    @{
        title = "AI-Powered Search Strategy 2025"
        content = "Comprehensive guide to implementing AI-powered search solutions using Elasticsearch and Vertex AI. Covers hybrid search, vector embeddings, and real-time analytics for enterprise applications."
        category = "Technology"
        department = "Engineering"  
        tags = @("AI", "Search", "Elasticsearch", "Innovation")
        author = "AI Research Team"
        last_updated = "2024-10-24"
    },
    @{
        title = "Remote Work Policy Guidelines"
        content = "Updated remote work policies for 2025, including flexible schedules, collaboration tools, and performance metrics. Designed to maximize productivity while maintaining work-life balance."
        category = "HR"
        department = "People Operations"
        tags = @("Remote Work", "Policy", "Productivity", "Guidelines")
        author = "HR Team"
        last_updated = "2024-10-15"
    },
    @{
        title = "Cloud Cost Optimization Best Practices"
        content = "Strategic approaches to reducing cloud infrastructure costs while maintaining performance. Covers auto-scaling, resource right-sizing, and monitoring strategies for GCP services."
        category = "Operations"
        department = "DevOps"
        tags = @("Cloud", "Cost", "Optimization", "GCP", "Performance")
        author = "DevOps Team"
        last_updated = "2024-10-20"
    }
)

foreach ($doc in $sampleDocs) {
    try {
        $docJson = $doc | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$ElasticsearchUrl/enterprise_docs/_doc" -Method Post -Body $docJson -Headers $headers | Out-Null
        Write-Host "      OK $($doc.title)" -ForegroundColor Green
    } catch {
        Write-Host "      Failed: $($doc.title)" -ForegroundColor Yellow
    }
}

# STEP 10: Update Configuration
Write-Host ""
Write-Host "STEP 10: Generate Configuration" -ForegroundColor Yellow
Write-Host "===============================" -ForegroundColor Yellow

$envContent = @"
# ELASTIC CONTEXT CONCIERGE - PRODUCTION CONFIGURATION
# Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss UTC'))

# Elasticsearch Configuration (GCP Marketplace)
ELASTICSEARCH_URL=$ElasticsearchUrl
ELASTICSEARCH_API_KEY=$ElasticsearchApiKey

# Google Cloud Project Configuration
GOOGLE_CLOUD_PROJECT=$ProjectId
GOOGLE_CLOUD_REGION=$Region
VERTEX_AI_LOCATION=$Region

# Vertex AI Models
VERTEX_EMBEDDING_MODEL=text-embedding-004
VERTEX_LLM_MODEL=gemini-2.0-flash-001

# Cloud Run Service URLs
GATEWAY_SERVICE_URL=$gatewayUrl
NEXT_PUBLIC_GATEWAY_URL=$gatewayUrl

# Application Configuration
NODE_ENV=production
PORT=8080

# Competition Features
COMPETITION_MODE=true
DEMO_DATA_ENABLED=true
PERFORMANCE_MONITORING=true
"@

Set-Content -Path ".env" -Value $envContent
Write-Host "   .env file updated" -ForegroundColor Green

# Test deployment
Write-Host ""
Write-Host "STEP 11: Test Deployment" -ForegroundColor Yellow
Write-Host "========================" -ForegroundColor Yellow

Write-Host "   Testing gateway health..." -ForegroundColor Cyan
try {
    $healthCheck = Invoke-RestMethod -Uri "$gatewayUrl/health" -TimeoutSec 30
    Write-Host "   Gateway Status: $($healthCheck.status)" -ForegroundColor Green
    Write-Host "   Version: $($healthCheck.version)" -ForegroundColor Gray
} catch {
    Write-Host "   Gateway health check failed, but service may still be starting..." -ForegroundColor Yellow
}

# DEPLOYMENT COMPLETE
Write-Host ""
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta
Write-Host ""

Write-Host "SERVICE URLS:" -ForegroundColor Yellow
Write-Host "   Gateway API: $gatewayUrl" -ForegroundColor Cyan
Write-Host "   Web App: $webUrl" -ForegroundColor Cyan
Write-Host "   Health: $gatewayUrl/health" -ForegroundColor Gray
Write-Host "   Metrics: $gatewayUrl/metrics/dashboard" -ForegroundColor Gray
Write-Host ""

Write-Host "COST ESTIMATE (Monthly):" -ForegroundColor Yellow
Write-Host "   Cloud Run: 0 USD (scale-to-zero)" -ForegroundColor Green
Write-Host "   Cloud Build: 0 USD (120 min/day free)" -ForegroundColor Green
Write-Host "   Secret Manager: 0 USD (6 secrets free)" -ForegroundColor Green  
Write-Host "   Artifact Registry: 0 USD (0.5GB free)" -ForegroundColor Green
Write-Host "   Vertex AI: ~2-5 USD (pay-per-use)" -ForegroundColor Yellow
Write-Host "   Elasticsearch: 0-73 USD (trial/serverless)" -ForegroundColor Yellow
Write-Host "   TOTAL: 2-78 USD/month" -ForegroundColor Cyan
Write-Host ""

Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "   1. Test: curl $gatewayUrl/health" -ForegroundColor White
Write-Host "   2. Validate: .\scripts\validate-hackathon.ps1" -ForegroundColor White
Write-Host "   3. Demo: Open $webUrl in browser" -ForegroundColor White
Write-Host "   4. Win: Create demo video and submit!" -ForegroundColor White
Write-Host ""

Write-Host "READY TO WIN 12500 USD FIRST PLACE!" -ForegroundColor Magenta