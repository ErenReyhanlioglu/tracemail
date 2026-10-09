-- Parse quality per week and group (ADR-0020 coverage and distribution):
-- LinkedIn per template, every other sender combined (SUMMARY.md). Raw
-- counts, never a bare percentage: weekly volume is small. A drop in one
-- group's parsed share points at a changed template.

with outcomes as (
    select
        date_trunc(received_date, isoweek) as week_start,
        case
            when parser_name is null then 'other'
            when template is null then concat(parser_name, ': unrecognized')
            else concat(parser_name, ': ', template)
        end as parse_group,
        parse_outcome
    from {{ ref('stg_mail__parse_outcomes') }}
)

select
    week_start,
    parse_group,
    count(*) as messages,
    countif(parse_outcome = 'parsed') as parsed,
    countif(parse_outcome = 'failed') as failed,
    countif(parse_outcome = 'unclaimed') as unclaimed
from outcomes
group by week_start, parse_group
