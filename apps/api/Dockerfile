# API image: the tracemail-api package from the committed workspace lock, run
# by uvicorn as a non-root user (CLAUDE.md, Deployment). Build context: the
# repository root (`docker build -f apps/api/Dockerfile .`). The same file
# builds for linux/amd64 (local) and linux/arm64 (the VM). Nothing secret
# enters a layer: settings and the key file come from the environment.

ARG PYTHON_VERSION=3.12
ARG UV_VERSION=0.11.7

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

FROM python:${PYTHON_VERSION}-slim-bookworm AS build
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /src
# Every workspace member's metadata is needed to resolve the lock; only the
# API package and its dependencies are installed.
COPY pyproject.toml uv.lock ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN UV_PROJECT_ENVIRONMENT=/opt/venv \
    uv sync --frozen --no-dev --no-editable --package tracemail-api

FROM python:${PYTHON_VERSION}-slim-bookworm
COPY --from=build /opt/venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1
# Group 0 can read the key file mounted for this service (infra/vm/README.md).
USER 10001:0
EXPOSE 8000
CMD ["uvicorn", "tracemail_api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
