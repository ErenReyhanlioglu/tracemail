-- Every posting seen in a job mail, newest first, with its company and, if
-- the owner applied, the application date. Tables resolve against the marts
-- dataset (the job's default dataset).
with applied as (
    select
        posting_key,
        min(applied_on) as applied_on
    from dim_applications
    group by posting_key
)

select
    postings.posting_key,
    postings.title,
    companies.company_name as company,
    postings.location,
    postings.posting_url,
    postings.first_seen_date,
    postings.last_seen_date,
    postings.mention_count,
    postings.is_saved,
    postings.has_application,
    applied.applied_on
from dim_postings as postings
left join dim_companies as companies
    on postings.company_key = companies.company_key
left join applied
    on postings.posting_key = applied.posting_key
order by
    postings.first_seen_date desc,
    postings.last_seen_date desc,
    postings.posting_key
