{#
    Use a model's configured schema (dataset) as written, e.g. "staging",
    instead of dbt's default "<target schema>_staging". Dev and prod are
    separate GCP projects (ADR-0010), so dataset names need no prefix.
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
