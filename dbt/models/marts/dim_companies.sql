-- One row per company that appeared in any posting.

with postings as (
    select
        {{ company_key('company') }} as company_key,
        company
    from {{ ref('int_postings_deduplicated') }}
    where company is not null
)

select
    company_key,
    min(company) as company_name,
    count(*) as posting_count
from postings
group by company_key
