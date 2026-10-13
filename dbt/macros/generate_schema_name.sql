{#
    Use a model's configured schema (dataset) as written, e.g. "staging",
    instead of dbt's default "<target schema>_staging". Dev and prod are
    separate GCP projects (ADR-0010), so dataset names need no prefix.

    The ci target builds into "ci_<schema>" in the dev project (ADR-0037), so
    a CI run can never write the datasets dev's own builds use.
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set schema = target.schema if custom_schema_name is none else custom_schema_name | trim -%}
    {%- if target.name == "ci" and not schema.startswith("ci_") -%}
        ci_{{ schema }}
    {%- else -%}
        {{ schema }}
    {%- endif -%}
{%- endmacro %}
