# Infrastructure

Everything that runs the system outside the Python packages. Implemented in
Phase 1, steps 1.7 and 1.11.

| Path | Contents |
|---|---|
| [`compose.yaml`](compose.yaml) | The single Compose definition for local runs and the VM (ADR-0016): Airflow, API, web app, and the Cloudflare tunnel |
| [`config/`](config/) | The sender exclusion list's format (`sender_exclusions.example.yaml`); the real list is private and never committed |
| [`gcp/`](gcp/README.md) | Least-privilege project setup script and the service account roles (ADR-0009, ADR-0010) |
| [`vm/`](vm/README.md) | Production VM: first boot, deploy user and scripts, continuous deployment, and what was verified on the VM (ADR-0012, ADR-0035) |
| `secrets/` | Local service account key files; ignored by git and Docker |
