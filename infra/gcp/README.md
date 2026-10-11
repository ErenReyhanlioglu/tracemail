# GCP project setup

`setup-project.sh` sets up one TraceMail project (dev or prod, ADR-0010):
APIs, the data bucket, the BigQuery datasets, and one service account per
role. It is idempotent; rerun it after changing it.

```bash
infra/gcp/setup-project.sh tracemail-prod tracemail-prod-data
```

Run it with an owner account (`gcloud auth login`). It creates no keys.

## Roles (least privilege)

| Service account | Grants | Used by |
|---|---|---|
| `tm-ingestion` | Storage Object User on the data bucket; BigQuery Job User on the project; Data Editor on `landing` and `ops` | IMAP ingestion, parsing, landing loads, run records |
| `tm-transform` | BigQuery Job User; Data Viewer on `landing` and `ops`; Data Editor on `staging`, `intermediate`, `marts` | dbt |
| `tm-api` | BigQuery Job User; Data Viewer on `marts` | API |

No account has a project-wide data role. Datasets are created by the script,
so no account needs permission to create them.

Notes:

- Storage Object User includes deleting objects, which overwriting a parsed
  file requires (ADR-0018). Raw objects stay write-once through the
  create-only precondition in code (ADR-0006), not through IAM.
- `tm-api` reads only `marts`. A mart view that selects from another dataset
  (the Phase 3 health views read `staging`) needs that dataset authorized for
  the view, or the API's access extended, when the health panel arrives.

## Verified (2026-10-11, `tracemail-prod`)

- The first run created the bucket, five datasets, three service accounts,
  and their grants; a second run created nothing ("exists" for every
  resource).
- Bucket: `US-CENTRAL1`, public access prevention `enforced`, uniform
  bucket-level access on.
- Dataset access lists show each account only where intended (for example
  `marts`: `tm-transform` writer, `tm-api` reader; `landing`: `tm-ingestion`
  writer, `tm-transform` reader). At project level the accounts hold only
  `roles/bigquery.jobUser`.
- Not yet verified: that a dbt build as `tm-transform` needs no permission to
  create datasets when they already exist. Checked with the first prod build.

## Keys (VM → GCP, ADR-0009)

The VM authenticates with one key file per role. Create them on the owner's
machine in `infra/secrets/`, which git (`secrets/`) and Docker
(`**/secrets`, `**/*.key.json`) both ignore, and copy them to the VM's
`/opt/tracemail/secrets/` (mode 600) over Tailscale:

```bash
mkdir -p infra/secrets
for role in ingestion transform api; do
  gcloud iam service-accounts keys create infra/secrets/tm-${role}.key.json \
    --iam-account "tm-${role}@tracemail-prod.iam.gserviceaccount.com"
done
```

Verified 2026-10-11: `git check-ignore` lists all three files, and a test
build of the repository root as Docker context contained no key file.

Never commit a key, put it in an image, a log, or a chat. Rotate a key by
creating a new one, replacing the file on the VM, and deleting the old key
(`gcloud iam service-accounts keys list / delete`).
