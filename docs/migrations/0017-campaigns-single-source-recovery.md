# Migration 0017 recovery

Migration 0017 is destructive only after its in-transaction ID, ownership, orphan,
and row-count checks pass. It keeps immutable copies of every removed table:

- `migration_0017_calling_campaigns_backup`
- `migration_0017_wa_campaigns_backup`
- `migration_0017_campaign_contacts_backup`
- `migration_0017_wa_campaign_recipients_backup`
- `migration_0017_templates_backup`
- `migration_0017_verification`

## Required production procedure

1. Stop all API and worker processes so no campaign writes occur.
2. Take a PostgreSQL custom-format backup before running the migration:

   `pg_dump --format=custom --file=pre-0017.dump "$DATABASE_URL"`

3. Run the migration on a restored copy first and inspect:

   `SELECT * FROM migration_0017_verification ORDER BY metric;`

4. Deploy the application and migration in the same maintenance window. Do not
   run pre-0017 application code after the migration commits.

## Preferred rollback

Stop the application and restore the pre-migration database backup:

`pg_restore --clean --if-exists --dbname="$DATABASE_URL" pre-0017.dump`

This is the only full rollback because application writes made after cutover
cannot be represented safely in both legacy channel schemas.

## Data-only emergency recovery

If the external dump is unavailable, the `migration_0017_*_backup` tables retain
the exact legacy rows. Export them before any repair:

```sql
COPY migration_0017_calling_campaigns_backup TO '/secure/calling_campaigns.csv' CSV HEADER;
COPY migration_0017_wa_campaigns_backup TO '/secure/wa_campaigns.csv' CSV HEADER;
COPY migration_0017_campaign_contacts_backup TO '/secure/campaign_contacts.csv' CSV HEADER;
COPY migration_0017_wa_campaign_recipients_backup TO '/secure/wa_campaign_recipients.csv' CSV HEADER;
COPY migration_0017_templates_backup TO '/secure/templates.csv' CSV HEADER;
```

Restore the pre-0017 schema from the matching application release or dump, then
copy these rows back with `OVERRIDING SYSTEM VALUE` where needed. Reapply
migrations only through 0016. Do not rename backup tables into production:
their copied indexes and defaults are evidence artifacts, not a complete
replacement for the old foreign keys and trigger functions.

Keep the backup and verification tables for at least one production retention
window. They may be dropped only after record counts, provider references,
soft-deleted rows, and representative campaign executions have been verified.
