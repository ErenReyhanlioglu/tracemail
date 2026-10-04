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
    uv run pytest -m integration --no-cov

# Everything CI runs: lint, typecheck, test
check: lint typecheck test

# Start the local Compose stack
up:
    docker compose -f {{compose_file}} up -d

# Stop the local Compose stack
down:
    docker compose -f {{compose_file}} down
