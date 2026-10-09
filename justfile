# Common development commands. Run `just --list` to see them.

set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

compose_file := "infra/compose.yaml"

# List available recipes
default:
    @just --list

# Lint and check formatting
lint:
    uv run ruff check .
    uv run ruff format --check .

# Format code and apply safe lint fixes
format:
    uv run ruff format .
    uv run ruff check --fix .

# Static type checking
typecheck:
    uv run mypy

# Run unit tests with coverage (integration tests excluded)
test:
    uv run pytest

# Run integration tests against the real dev cloud project
test-integration:
    uv run --env-file .env pytest -m integration --no-cov

# Everything CI runs: lint, typecheck, test
check: lint typecheck test

# List mailbox folder names (to set TRACEMAIL_IMAP_MAILBOX)
list-mailboxes:
    uv run --env-file .env python -m tracemail_pipeline.cli list-mailboxes

# Ingest mail for [start, end) into the dev raw zone, e.g. just ingest-mail 2026-10-01 2026-10-04
ingest-mail start end:
    uv run --env-file .env python -m tracemail_pipeline.cli ingest-mail --start-date {{start}} --end-date {{end}}

# Count stored raw mail per sender domain for [start, end)
raw-inventory start end:
    uv run --env-file .env python -m tracemail_pipeline.cli raw-inventory --start-date {{start}} --end-date {{end}}

# Parse raw mail for [start, end) into the dev parsed zone (overwrites those days)
parse-mail start end:
    uv run --env-file .env python -m tracemail_pipeline.cli parse-mail --start-date {{start}} --end-date {{end}}

# Load the parsed zone for [start, end) into dev BigQuery landing (replaces those days)
load-landing start end:
    uv run --env-file .env python -m tracemail_pipeline.cli load-landing --start-date {{start}} --end-date {{end}}

# Row counts and content fingerprints of landing tables for [start, end)
landing-check start end:
    uv run --env-file .env python -m tracemail_pipeline.cli landing-check --start-date {{start}} --end-date {{end}}

# Start the local Compose stack
up:
    docker compose -f {{compose_file}} up -d

# Stop the local Compose stack
down:
    docker compose -f {{compose_file}} down
