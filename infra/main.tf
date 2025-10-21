terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "required_apis" {
  for_each = toset([
    "aiplatform.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com"
  ])
  service = each.key
  disable_on_destroy = false
}

resource "google_service_account" "cloud_run_sa" {
  account_id   = "elastic-concierge-run"
  display_name = "Elastic Context Concierge Service Account"
}

resource "google_project_iam_member" "sa_vertex_ai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}
