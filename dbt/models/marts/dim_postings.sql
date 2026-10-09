-- One row per posting. The posting URL is rebuilt from the job id: links in
-- mails carry personal tracking tokens and are never stored.

with postings as (
    select * from {{ ref('int_postings_deduplicated') }}
),

applied as (
    select distinct posting_key
    from {{ ref('int_application_events_unioned') }}
)

select
    postings.posting_key,
    postings.posting_source,
    postings.job_id,
    postings.title,
    {{ company_key('postings.company') }} as company_key,
    postings.location,
    if(
        postings.posting_source = 'linkedin',
        concat('{{ var("linkedin_job_url_prefix") }}', postings.job_id, '/'),
        null
    ) as posting_url,
    postings.first_seen_date,
    postings.last_seen_date,
    postings.mention_count,
    postings.is_saved,
    applied.posting_key is not null as has_application
from postings
left join applied on postings.posting_key = applied.posting_key
