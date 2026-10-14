-- BigQuery storage for the health panel (ADR-0044), in a query of its own:
-- metadata alone is billed 0 bytes, joined to the panel query it would cost
-- 10 MiB per dataset.
select allowance, used_to_date, monthly_free
from fct_bigquery_storage
