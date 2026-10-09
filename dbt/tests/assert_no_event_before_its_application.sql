-- An employer cannot react to an application before it was submitted.
-- Returns the offending events; the test passes when none are returned.

select
    events.event_key,
    events.event_type,
    events.event_date,
    applications.applied_on
from {{ ref('fct_application_events') }} as events
inner join {{ ref('dim_applications') }} as applications
    on events.application_key = applications.application_key
where events.event_date < applications.applied_on
