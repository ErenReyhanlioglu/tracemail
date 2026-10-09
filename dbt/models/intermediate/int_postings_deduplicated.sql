-- One row per posting, however many mails mentioned it. Title, company, and
-- location come from the most recent mention that has them (a few postings
-- are renamed over time).

with mentions as (
    select * from {{ ref('int_posting_mentions_unioned') }}
)

select
    {{ dbt_utils.generate_surrogate_key(['posting_source', 'job_id']) }}
        as posting_key,
    posting_source,
    job_id,
    array_agg(title ignore nulls order by received_date desc, source_key desc
        limit 1)[safe_offset(0)] as title,
    array_agg(company ignore nulls order by received_date desc, source_key desc
        limit 1)[safe_offset(0)] as company,
    array_agg(location ignore nulls order by received_date desc, source_key desc
        limit 1)[safe_offset(0)] as location,
    min(received_date) as first_seen_date,
    max(received_date) as last_seen_date,
    count(*) as mention_count,
    logical_or(mention_type = 'action_saved') as is_saved
from mentions
group by posting_source, job_id
