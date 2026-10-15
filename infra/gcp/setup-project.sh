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

# A Python that runs: on Windows, "python3" can be the Microsoft Store stub,
# which exists on PATH but only prints an error.
find_python() {
  local candidate
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "" >/dev/null 2>&1; then
      echo "$candidate"
      return
    fi
  done
  echo "No working Python found" >&2
  exit 1
}

# Exit code of the access-list edit when the entry is already there.
ALREADY_AUTHORIZED=3

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

# Authorizes every view in one dataset to read another (an authorized
# dataset): the health views in marts read run records through staging, and
# storage metadata in every dataset (ADR-0044), while tm-api reads marts
# only. Adds the entry to the dataset's access list if it is missing.
authorize_dataset() {
  local reader="$1" source="$2" py file status=0
  py="$(find_python)"
  file="$(mktemp)"
  bq --project_id "$PROJECT" show --format=prettyjson "${PROJECT}:${source}" >"$file"
  "$py" - "$file" "$PROJECT" "$reader" "$ALREADY_AUTHORIZED" <<'EOF' || status=$?
import json, sys
path, project, reader, already = sys.argv[1:]
dataset = json.load(open(path, encoding="utf-8"))
entry = {"dataset": {"dataset": {"projectId": project, "datasetId": reader},
                     "targetTypes": ["VIEWS"]}}
access = dataset.setdefault("access", [])
if any(e.get("dataset", {}).get("dataset") == entry["dataset"]["dataset"] for e in access):
    sys.exit(int(already))
access.append(entry)
json.dump({"access": access}, open(path, "w", encoding="utf-8"))
EOF
  if [[ "$status" -eq "$ALREADY_AUTHORIZED" ]]; then
    log "Views in ${reader} already authorized on ${source}"
  elif [[ "$status" -eq 0 ]]; then
    log "Authorizing views in ${reader} on ${source}"
    bq --project_id "$PROJECT" update --source "$file" "${PROJECT}:${source}" >/dev/null
  else
    rm -f "$file"
    echo "Editing the access list of ${source} failed (exit ${status})" >&2
    exit 1
  fi
  rm -f "$file"
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

  # API: read the marts only. The health views reach further as authorized
  # views.
  grant_job_user "$API"
  grant_dataset "$API" roles/bigquery.dataViewer marts
  for dataset in landing ops staging intermediate; do
    authorize_dataset marts "$dataset"
  done
  # Staging's views read ops (run records) and landing (deployments,
  # ADR-0045) on marts' behalf.
  authorize_dataset staging ops
  authorize_dataset staging landing
}

enable_apis
create_bucket
create_datasets
setup_roles
log "Done: ${PROJECT}"
