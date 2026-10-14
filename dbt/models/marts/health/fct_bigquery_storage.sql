-- BigQuery storage now (ADR-0044): the logical bytes of every table in the
-- project's five datasets, from each dataset's __TABLES__ metadata, against
-- the free tier. Views hold no data. Only the current size exists, with no
-- history, so there is no month-end projection. A read-time view.
--
-- Kept out of fct_free_tier_usage on purpose: a query of metadata alone is
-- billed 0 bytes, but in a query that also reads a table every __TABLES__
-- counts toward the 10 MiB minimum (measured 2026-10-14: 0 against 60 MiB).

{% set datasets = [
    source('mail', 'job_posting_sightings').schema,
    source('ops', 'pipeline_runs').schema,
    generate_schema_name('staging', none),
    generate_schema_name('intermediate', none),
    generate_schema_name('marts', none),
] %}

with tables as (
    {% for dataset in datasets %}
    select size_bytes
    from `{{ target.project }}.{{ dataset }}.__TABLES__`
    {% if not loop.last %}union all{% endif %}
    {% endfor %}
)

select
    'bigquery_storage_bytes' as allowance,
    count(*) as tables,
    coalesce(sum(size_bytes), 0) as used_to_date,
    {{ var('free_tier_bigquery_storage_bytes') }} as monthly_free
from tables
