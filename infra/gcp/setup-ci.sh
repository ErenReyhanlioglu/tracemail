#!/usr/bin/env bash
# Sets up the dbt build in GitHub Actions on the dev project (ADR-0037):
# Workload Identity Federation for this repository, the CI service account
# with least privilege, and the ci_* datasets it builds into.
#
# Usage: infra/gcp/setup-ci.sh <dev-project-id> <github-owner-id> <github-repo-id>
#
# The GitHub IDs are the numeric, immutable ones in the repository's OIDC
# subject (repo:<owner>@<owner-id>/<repo>@<repo-id>:...), never names, which
# can be reused. Idempotent like setup-project.sh: resources are created only
# if missing and IAM bindings are additive. No key is ever created.
set -euo pipefail

readonly USAGE="usage: setup-ci.sh <dev-project-id> <github-owner-id> <github-repo-id>"
PROJECT="${1:?$USAGE}"
OWNER_ID="${2:?$USAGE}"
REPO_ID="${3:?$USAGE}"
readonly REGION="us-central1"
readonly POOL="github"
readonly PROVIDER="tracemail"
readonly CI_ACCOUNT="tm-ci-dbt"
readonly CI_DATASETS=(ci_staging ci_intermediate ci_marts)
# CI rebuilds everything on each run; leftovers expire after a week.
readonly CI_TABLE_EXPIRATION_SECONDS=604800

sa_email() { echo "$1@${PROJECT}.iam.gserviceaccount.com"; }

log() { echo "== $*"; }

enable_apis() {
  log "Enabling APIs"
  gcloud services enable --project "$PROJECT" \
    iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com
}

create_ci_datasets() {
  for dataset in "${CI_DATASETS[@]}"; do
    if bq --project_id "$PROJECT" show "${PROJECT}:${dataset}" >/dev/null 2>&1; then
      log "Dataset ${dataset} exists"
    else
      log "Creating dataset ${dataset} in ${REGION}"
      bq --project_id "$PROJECT" --location "$REGION" mk --dataset \
        --default_table_expiration "$CI_TABLE_EXPIRATION_SECONDS" "${PROJECT}:${dataset}"
    fi
  done
}

create_ci_account() {
  if gcloud iam service-accounts describe "$(sa_email "$CI_ACCOUNT")" --project "$PROJECT" >/dev/null 2>&1; then
    log "Service account ${CI_ACCOUNT} exists"
    return
  fi
  log "Creating service account ${CI_ACCOUNT}"
  gcloud iam service-accounts create "$CI_ACCOUNT" --project "$PROJECT" \
    --display-name "$CI_ACCOUNT" --description "dbt build in GitHub Actions (dev only)"
}

# Dataset-level grant with BigQuery DCL (no bytes billed).
grant_dataset() {
  local role="$1" dataset="$2"
  log "Granting ${role} on ${dataset} to ${CI_ACCOUNT}"
  bq --project_id "$PROJECT" query --use_legacy_sql=false --location "$REGION" --quiet \
    "GRANT \`${role}\` ON SCHEMA \`${PROJECT}.${dataset}\` TO \"serviceAccount:$(sa_email "$CI_ACCOUNT")\"" \
    >/dev/null
}

grant_ci_account() {
  log "Granting BigQuery Job User on the project to ${CI_ACCOUNT}"
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:$(sa_email "$CI_ACCOUNT")" --role roles/bigquery.jobUser \
    --condition None --quiet >/dev/null
  # Read the sources; write only the CI datasets.
  grant_dataset roles/bigquery.dataViewer landing
  grant_dataset roles/bigquery.dataViewer ops
  for dataset in "${CI_DATASETS[@]}"; do
    grant_dataset roles/bigquery.dataEditor "$dataset"
  done
}

create_pool_and_provider() {
  if gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT" --location global >/dev/null 2>&1; then
    log "Workload identity pool ${POOL} exists"
  else
    log "Creating workload identity pool ${POOL}"
    gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" \
      --location global --display-name "GitHub Actions"
  fi
  if gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$PROJECT" \
    --location global --workload-identity-pool "$POOL" >/dev/null 2>&1; then
    log "Provider ${PROVIDER} exists"
    return
  fi
  log "Creating provider ${PROVIDER}, limited to repository ${REPO_ID} of owner ${OWNER_ID}"
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT" \
    --location global --workload-identity-pool "$POOL" --display-name "tracemail repository" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id" \
    --attribute-condition "assertion.repository_owner_id == '${OWNER_ID}' && assertion.repository_id == '${REPO_ID}'"
}

allow_repository_to_impersonate() {
  local number pool_path
  number="$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')"
  pool_path="projects/${number}/locations/global/workloadIdentityPools/${POOL}"
  log "Allowing repository ${REPO_ID} to act as ${CI_ACCOUNT}"
  gcloud iam service-accounts add-iam-policy-binding "$(sa_email "$CI_ACCOUNT")" --project "$PROJECT" \
    --role roles/iam.workloadIdentityUser \
    --member "principalSet://iam.googleapis.com/${pool_path}/attribute.repository_id/${REPO_ID}" \
    >/dev/null
  echo
  echo "GitHub repository variables:"
  echo "  GCP_WORKLOAD_IDENTITY_PROVIDER = ${pool_path}/providers/${PROVIDER}"
  echo "  GCP_CI_SERVICE_ACCOUNT         = $(sa_email "$CI_ACCOUNT")"
}

enable_apis
create_ci_datasets
create_ci_account
grant_ci_account
create_pool_and_provider
allow_repository_to_impersonate
log "Done: CI on ${PROJECT}"
