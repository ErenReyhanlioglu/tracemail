# Airflow image with three isolated Python environments (ADR-0003, ADR-0013):
#   1. Airflow itself, plus Cosmos, installed under Airflow's constraint file;
#   2. /opt/venvs/dbt: dbt from dbt/uv.lock, run by Cosmos (ADR-0029);
#   3. /opt/venvs/pipeline: the pipeline package from the workspace lock, run
#      by @task.external_python.
# The same image builds for linux/amd64 (local) and linux/arm64 (the VM).
# Nothing secret enters any layer: .env, keys, and the private exclusion list
# are excluded by .dockerignore and mounted at run time.

ARG AIRFLOW_VERSION=3.3.2
ARG PYTHON_VERSION=3.12
ARG UV_VERSION=0.11.7

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

FROM apache/airflow:${AIRFLOW_VERSION}-python${PYTHON_VERSION}
ARG AIRFLOW_VERSION
ARG PYTHON_VERSION
ARG COSMOS_VERSION=1.15.1

# 1. Airflow environment: Cosmos pinned, everything held to Airflow's constraints.
RUN pip install --no-cache-dir \
        "apache-airflow==${AIRFLOW_VERSION}" \
        "astronomer-cosmos==${COSMOS_VERSION}" \
        --constraint "https://raw.githubusercontent.com/apache/airflow/constraints-${AIRFLOW_VERSION}/constraints-${PYTHON_VERSION}.txt"

USER root
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON=python${PYTHON_VERSION}

# Layers ordered from least to most frequently changed, so a pipeline code
# change rebuilds only the last layers.
WORKDIR /opt/tracemail

# 2. dbt environment and project, with packages installed at build time.
COPY dbt/pyproject.toml dbt/uv.lock ./dbt/
RUN UV_PROJECT_ENVIRONMENT=/opt/venvs/dbt uv sync --frozen --project ./dbt
COPY dbt /opt/airflow/dbt
# The manifest lets Cosmos render the DAG without running dbt at parse time
# (LoadMode.DBT_MANIFEST). Parsing needs no warehouse access, only values for
# the profile's env_var() calls, so placeholders are used here; real values
# come from the environment when dbt runs.
RUN /opt/venvs/dbt/bin/dbt deps --project-dir /opt/airflow/dbt \
    && TRACEMAIL_GCP_PROJECT=build-placeholder \
       TRACEMAIL_BQ_LOCATION=build-placeholder \
       TRACEMAIL_BQ_MAX_BYTES_BILLED=0 \
       TRACEMAIL_BQ_LANDING_DATASET=build-placeholder \
       TRACEMAIL_BQ_OPS_DATASET=build-placeholder \
       /opt/venvs/dbt/bin/dbt parse --project-dir /opt/airflow/dbt --profiles-dir /opt/airflow/dbt \
    && chown -R airflow:root /opt/airflow/dbt

# Owned by the airflow user so the named state volume inherits it.
RUN mkdir -p /opt/airflow/state && chown airflow:root /opt/airflow/state

# 3. Pipeline environment, from the committed workspace lock (no dev tools).
COPY pyproject.toml uv.lock ./
COPY packages ./packages
COPY apps/api/pyproject.toml ./apps/api/pyproject.toml
RUN UV_PROJECT_ENVIRONMENT=/opt/venvs/pipeline \
    uv sync --frozen --no-dev --no-editable --package tracemail-pipeline

WORKDIR /opt/airflow
USER airflow
