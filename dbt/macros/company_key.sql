{#
    Deterministic company key from a company name column. Names are compared
    case- and whitespace-insensitively, so every model that refers to a
    company produces the same key (CLAUDE.md: surrogate keys are hashes of
    natural keys). An unknown company has no key, rather than a key that
    stands for "no company".
#}
{% macro company_key(column) -%}
    if(
        {{ column }} is null,
        null,
        {{ dbt_utils.generate_surrogate_key(['lower(trim(' ~ column ~ '))']) }}
    )
{%- endmacro %}
