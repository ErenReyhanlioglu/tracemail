-- Data freshness (ADR-0020): the newest stored message's received date and
-- its age in the owner's local days. A single row; a read-time view.

with outcomes as (
    select received_date from {{ ref('stg_mail__parse_outcomes') }}
)

select
    max(received_date) as newest_received_date,
    date_diff(
        current_date('{{ var("display_timezone") }}'), max(received_date), day
    ) as days_since_newest_mail,
    count(*) as messages_stored
from outcomes
