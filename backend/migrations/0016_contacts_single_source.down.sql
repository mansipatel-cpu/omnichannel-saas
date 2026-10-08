-- Rollback of 0016_contacts_single_source.up.sql.
-- Run with: node scripts/run-down-migration.mjs 0016_contacts_single_source
-- Also revert the contacts-stage code change (app code, 0011 phone normalizer and the
-- 0016 entry in scripts/run-safe-migration.mjs), or the next run re-applies it.
--
-- No rows are deleted: wa_contacts gets its own name/phone/email/tags/groups back
-- from `contacts`, and backup_wa_contacts_0016 / contacts_phone_fixes_0016 are kept.
-- Phones come back in E.164 form (the old table stored whatever was sent).

DROP VIEW IF EXISTS wa_contacts;

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_phone_e164_check;
DROP INDEX IF EXISTS contacts_user_created_idx;
DROP INDEX IF EXISTS whatsapp_contact_channels_user_id_idx;
DROP INDEX IF EXISTS whatsapp_contact_channels_channel_created_idx;

DO $$
BEGIN
    IF to_regclass('public.whatsapp_contact_channels') IS NULL THEN
        RETURN;
    END IF;

    ALTER TABLE whatsapp_contact_channels
        ADD COLUMN tenant_id varchar,
        ADD COLUMN name text,
        ADD COLUMN phone text,
        ADD COLUMN email text,
        ADD COLUMN groups jsonb DEFAULT '[]'::jsonb,
        ADD COLUMN tags jsonb DEFAULT '[]'::jsonb,
        ADD COLUMN source varchar(100);

    UPDATE whatsapp_contact_channels d
    SET tenant_id = d.user_id,
        name      = coalesce(nullif(c.name, ''), c.phone),
        phone     = c.phone,
        email     = c.email,
        tags      = coalesce(c.tags, '[]'::jsonb),
        source    = c.source,
        groups    = coalesce((SELECT jsonb_agg(g.name ORDER BY g.name)
                              FROM contact_group_members m
                              JOIN contact_groups g ON g.id = m.group_id
                              WHERE m.contact_id = c.id AND g.user_id = d.user_id), '[]'::jsonb)
    FROM contacts c
    WHERE c.id = d.contact_id;

    ALTER TABLE whatsapp_contact_channels
        DROP CONSTRAINT whatsapp_contact_channels_channel_contact_unique,
        DROP CONSTRAINT whatsapp_contact_channels_contact_id_contacts_id_fk,
        DROP CONSTRAINT whatsapp_contact_channels_user_id_users_id_fk,
        DROP COLUMN user_id,
        ALTER COLUMN name SET NOT NULL,
        ALTER COLUMN phone SET NOT NULL,
        ALTER COLUMN contact_id DROP NOT NULL,
        ALTER COLUMN created_at DROP NOT NULL,
        ALTER COLUMN updated_at DROP NOT NULL,
        ADD CONSTRAINT contacts_channel_phone_unique UNIQUE (channel_id, phone),
        ADD CONSTRAINT wa_contacts_contact_id_contacts_id_fk
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

    ALTER TABLE whatsapp_contact_channels RENAME TO wa_contacts;
    ALTER TABLE wa_contacts RENAME CONSTRAINT whatsapp_contact_channels_pkey TO wa_contacts_pkey;
    ALTER TABLE wa_contacts RENAME CONSTRAINT whatsapp_contact_channels_store_external_unique TO contacts_store_external_unique;
    ALTER TABLE wa_contacts RENAME CONSTRAINT whatsapp_contact_channels_channel_id_channels_id_fk TO wa_contacts_channel_id_channels_id_fk;
    ALTER TABLE wa_contacts RENAME CONSTRAINT whatsapp_contact_channels_store_id_shopify_stores_id_fk TO wa_contacts_store_id_shopify_stores_id_fk;
    ALTER TABLE wa_contacts RENAME CONSTRAINT whatsapp_contact_channels_created_by_users_id_fk TO wa_contacts_created_by_users_id_fk;
    ALTER INDEX whatsapp_contact_channels_channel_idx RENAME TO wa_contacts_channel_idx;
    ALTER INDEX whatsapp_contact_channels_status_idx RENAME TO wa_contacts_status_idx;
    ALTER INDEX whatsapp_contact_channels_store_idx RENAME TO wa_contacts_store_idx;
    ALTER INDEX whatsapp_contact_channels_external_id_idx RENAME TO wa_contacts_external_id_idx;
    ALTER INDEX whatsapp_contact_channels_contact_id_idx RENAME TO wa_contacts_contact_id_idx;
    CREATE INDEX IF NOT EXISTS wa_contacts_phone_idx ON wa_contacts (phone);
    CREATE INDEX IF NOT EXISTS wa_contacts_tenant_idx ON wa_contacts (tenant_id);

    ALTER TABLE abandoned_carts RENAME CONSTRAINT abandoned_carts_contact_id_whatsapp_contact_channels_id_fk
        TO abandoned_carts_contact_id_wa_contacts_id_fk;
    ALTER TABLE automation_executions RENAME CONSTRAINT automation_executions_contact_id_whatsapp_contact_channels_id_fk
        TO automation_executions_contact_id_wa_contacts_id_fk;
    ALTER TABLE conversations RENAME CONSTRAINT conversations_contact_id_whatsapp_contact_channels_id_fk
        TO conversations_contact_id_wa_contacts_id_fk;
    ALTER TABLE wa_campaign_recipients RENAME CONSTRAINT wa_campaign_recipients_contact_id_whatsapp_contact_channels_id_fk
        TO wa_campaign_recipients_contact_id_wa_contacts_id_fk;
END $$;

-- Undo the +1 91XXXXXXXXXX repairs (the log table is kept).
DO $$
BEGIN
    IF to_regclass('public.contacts_phone_fixes_0016') IS NOT NULL THEN
        UPDATE contacts c
        SET phone = f.old_phone, updated_at = now()
        FROM contacts_phone_fixes_0016 f
        WHERE f.contact_id = c.id AND c.phone = f.new_phone;
    END IF;
END $$;

-- Phone normalization as it was in 0011.
CREATE OR REPLACE FUNCTION normalize_contact_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN d = '' THEN NULL
        WHEN has_plus THEN '+' || d
        WHEN d LIKE '00%' AND length(d) > 2 THEN '+' || substr(d, 3)
        WHEN length(d) >= 10 THEN '+' || d
        ELSE d
    END
    FROM (
        SELECT regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') AS d,
               btrim(coalesce(p, '')) LIKE '+%' AS has_plus
    ) s
$$;
