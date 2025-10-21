# Deployment Guide

## Prerequisites
- Node.js 20+
- Google Cloud account with billing
- Elastic Cloud account
- gcloud CLI
- Terraform

## Steps

### 1. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 2. Deploy Infrastructure
```bash
cd infra
terraform init
terraform apply
```

### 3. Build and Deploy Services
```bash
./scripts/deploy-services.sh
```

### 4. Ingest Sample Data
```bash
npm run ingest
```

### 5. Access Application
Open the Cloud Run URL from deployment output.

## Troubleshooting
- Check Cloud Run logs: `gcloud run services logs read SERVICE_NAME`
- Verify secrets: `gcloud secrets list`
- Test API: `curl GATEWAY_URL/health`
