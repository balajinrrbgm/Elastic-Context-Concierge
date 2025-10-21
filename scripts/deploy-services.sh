#!/bin/bash
set -e

echo "🚀 Deploying Elastic Context Concierge..."

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"

# Build and deploy gateway
cd services/gateway
gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/elastic-concierge/gateway:latest
gcloud run deploy elastic-concierge-gateway --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/elastic-concierge/gateway:latest --region ${REGION}

# Build and deploy web
cd ../../web
gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/elastic-concierge/web:latest
gcloud run deploy elastic-concierge-web --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/elastic-concierge/web:latest --region ${REGION}

echo "✅ Deployment complete!"
