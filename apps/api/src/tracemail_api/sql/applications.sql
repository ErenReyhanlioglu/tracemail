-- Every application with its company, posting link, and waiting time.
-- Tables resolve against the marts dataset (the job's default dataset).
select
    applications.application_key,
    companies.company_name as company,
    applications.title,
    applications.location,
    applications.channel,
    postings.posting_url,
    applications.applied_on,
    applications.current_status,
    applications.last_event_date,
    status.days_since_last_event,
    status.is_silent,
    status.is_closed_without_reply,
    applications.event_count
from dim_applications as applications
left join dim_application_status as status
    on applications.application_key = status.application_key
left join dim_companies as companies
    on applications.company_key = companies.company_key
left join dim_postings as postings
    on applications.posting_key = postings.posting_key
order by applications.last_event_date desc, applications.application_key
