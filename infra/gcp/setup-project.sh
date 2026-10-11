#!/usr/bin/env bash
# Sets up one TraceMail GCP project: APIs, the data bucket, the BigQuery
# datasets, and one service account per role with least privilege
# (CLAUDE.md, Configuration and Secrets; ADR-0009, ADR-0010, ADR-0011).
#
# Usage: infra/gcp/setup-project.sh <project-id> <bucket-name>
#
# Idempotent: every resource is created only if missing, and IAM bindings are
# additive, so rerunning the script converges to the same state. It never
# creates service account keys; see README.md for that step.
set -euo pipefail

PROJECT="${1:?usage: setup-project.sh <project-id> <bucket-name>}"
BUCKET="${2:?usage: setup-project.sh <project-id> <bucket-name>}"
REGION="us-central1"
DATASETS=(landing staging intermediate marts ops)

INGESTION="tm-ingestion"
TRANSFORM="tm-transform"
API="tm-api"

sa_email() { echo "$1@${PROJECT}.iam.gserviceaccount.com"; }

log() { echo "== $*"; }

enable_apis() {
  log "Enabling APIs"
  gcloud services enable --project "$PROJECT" \
    bigquery.googleapis.com storage.googleapis.com iam.googleapis.com
}

create_bucket() {
  if gcloud storage buckets describe "gs://${BUCKET}" --project "$PROJECT" >/dev/null 2>&1; then
    log "Bucket gs://${BUCKET} exists"
    return
  fi
  log "Creating bucket gs://${BUCKET} in ${REGION}"
  gcloud storage buckets create "gs://${BUCKET}" --project "$PROJECT" \
    --location "$REGION" --default-storage-class STANDARD \
    --uniform-bucket-level-access --public-access-prevention
}

create_datasets() {
  for dataset in "${DATASETS[@]}"; do
    if bq --project_id "$PROJECT" show "${PROJECT}:${dataset}" >/dev/null 2>&1; then
      log "Dataset ${dataset} exists"
    else
      log "Creating dataset ${dataset} in ${REGION}"
      bq --project_id "$PROJECT" --location "$REGION" mk --dataset "${PROJECT}:${dataset}"
    fi
  done
}

create_service_account() {
  local name="$1" description="$2"
  if gcloud iam service-accounts describe "$(sa_email "$name")" --project "$PROJECT" >/dev/null 2>&1; then
    log "Service account ${name} exists"
    return
  fi
  log "Creating service account ${name}"
  gcloud iam service-accounts create "$name" --project "$PROJECT" \
    --display-name "$name" --description "$description"
}

grant_job_user() {
  log "Granting BigQuery Job User on the project to $1"
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:$(sa_email "$1")" --role roles/bigquery.jobUser \
    --condition None --quiet >/dev/null
}

# Dataset-level grant with BigQuery DCL (no bytes billed).
grant_dataset() {
  local name="$1" role="$2" dataset="$3"
  log "Granting ${role} on ${dataset} to ${name}"
  bq --project_id "$PROJECT" query --use_legacy_sql=false --location "$REGION" --quiet \
    "GRANT \`${role}\` ON SCHEMA \`${PROJECT}.${dataset}\` TO \"serviceAccount:$(sa_email "$name")\"" \
    >/dev/null
}

grant_bucket() {
  log "Granting $2 on gs://${BUCKET} to $1"
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" --project "$PROJECT" \
    --member "serviceAccount:$(sa_email "$1")" --role "$2" >/dev/null
}

setup_roles() {
  create_service_account "$INGESTION" "IMAP ingestion, parsing, landing loads, run records"
  create_service_account "$TRANSFORM" "dbt builds"
  create_service_account "$API" "Read-only API over the marts"

  # Ingestion: read and write the raw and parsed zones; load landing; write
  # run records to ops.
  grant_bucket "$INGESTION" roles/storage.objectUser
  grant_job_user "$INGESTION"
  grant_dataset "$INGESTION" roles/bigquery.dataEditor landing
  grant_dataset "$INGESTION" roles/bigquery.dataEditor ops

  # Transform: read landing and ops; build staging, intermediate, marts.
  grant_job_user "$TRANSFORM"
  grant_dataset "$TRANSFORM" roles/bigquery.dataViewer landing
  grant_dataset "$TRANSFORM" roles/bigquery.dataViewer ops
  for dataset in staging intermediate marts; do
    grant_dataset "$TRANSFORM" roles/bigquery.dataEditor "$dataset"
  done

  # API: read the marts only.
  grant_job_user "$API"
  grant_dataset "$API" roles/bigquery.dataViewer marts
}

enable_apis
create_bucket
create_datasets
setup_roles
log "Done: ${PROJECT}"
