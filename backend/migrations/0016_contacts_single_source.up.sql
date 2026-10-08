-- Contacts stage: the shared `contacts` table is the only place a person's
-- name, phone, email, tags and source are stored.
--
--   wa_contacts (table)        -> whatsapp_contact_channels: one row per WhatsApp
--                                 channel a contact is reachable on (same ids, so
--                                 conversations / campaign recipients / carts /
--                                 automation executions keep their foreign keys)
--   wa_contacts (view)         -> read-only, old column set, for existing readers
--   normalize_contact_phone()  -> returns E.164 or NULL; 10-digit numbers are +91
--
-- Idempotent: run-safe-migration.mjs re-applies every file on each run.
-- Rollback:   node scripts/run-down-migration.mjs 0016_contacts_single_source

-- ---------------------------------------------------------------------------
-- 1. Phone normalization (must match normalizePhone in contact-identity.service.js)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_contact_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN e ~ '^\+[1-9][0-9]{7,14}$' THEN e END
    FROM (
        SELECT CASE
            WHEN d = '' THEN NULL
            WHEN has_plus THEN '+' || d
            WHEN d LIKE '00%' AND length(d) > 2 THEN '+' || substr(d, 3)
            WHEN length(d) = 10 THEN '+91' || d
            WHEN length(d) = 11 AND d LIKE '0%' THEN '+91' || substr(d, 2)
            WHEN length(d) > 10 THEN '+' || d
        END AS e
        FROM (
            SELECT regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') AS d,
                   btrim(coalesce(p, '')) LIKE '+%' AS has_plus
        ) s
    ) n
$$;

-- ---------------------------------------------------------------------------
-- 2. Repair Indian numbers stored with a stray +1 (+1 91XXXXXXXXXX), logging
--    every change so it can be reverted.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts_phone_fixes_0016 (
    contact_id varchar PRIMARY KEY,
    user_id    varchar NOT NULL,
    old_phone  text NOT NULL,
    new_phone  text NOT NULL,
    fixed_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
    clash int;
BEGIN
    SELECT count(*) INTO clash
    FROM contacts c
    JOIN contacts o ON o.user_id = c.user_id AND o.phone = '+' || substr(c.phone, 3)
    WHERE c.phone ~ '^\+191[0-9]{10}$';
    IF clash > 0 THEN
        RAISE EXCEPTION '0016: % contacts with a stray +1 already exist under their corrected +91 number; merge them first', clash;
    END IF;

    INSERT INTO contacts_phone_fixes_0016 (contact_id, user_id, old_phone, new_phone)
    SELECT id, user_id, phone, '+' || substr(phone, 3)
    FROM contacts
    WHERE phone ~ '^\+191[0-9]{10}$'
    ON CONFLICT (contact_id) DO NOTHING;

    UPDATE contacts c
    SET phone = f.new_phone, updated_at = now()
    FROM contacts_phone_fixes_0016 f
    WHERE f.contact_id = c.id AND c.phone = f.old_phone;
END $$;

-- ---------------------------------------------------------------------------
-- 3. wa_contacts table -> whatsapp_contact_channels (runs once)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    unlinked int;
BEGIN
    IF (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.wa_contacts')) IS DISTINCT FROM 'r' THEN
        RETURN;
    END IF;

    CREATE TABLE IF NOT EXISTS backup_wa_contacts_0016 AS
    SELECT id, channel_id, tenant_id, name, phone, email, groups, tags, status, source, store_id,
           external_id, last_contact, created_at, updated_at, created_by, contact_id
    FROM wa_contacts WITH NO DATA;
    INSERT INTO backup_wa_contacts_0016
    SELECT w.id, w.channel_id, w.tenant_id, w.name, w.phone, w.email, w.groups, w.tags, w.status, w.source,
           w.store_id, w.external_id, w.last_contact, w.created_at, w.updated_at, w.created_by, w.contact_id
    FROM wa_contacts w
    WHERE NOT EXISTS (SELECT 1 FROM backup_wa_contacts_0016 b WHERE b.id = w.id);

    UPDATE wa_contacts w
    SET contact_id = ensure_shared_contact(
            coalesce(wa_campaign_owner_id(w.channel_id, w.created_by), account_owner_id(w.tenant_id)),
            w.phone, w.name, NULL, NULL, w.email, coalesce(w.source, 'whatsapp'))
    WHERE w.contact_id IS NULL;

    SELECT count(*) INTO unlinked FROM wa_contacts WHERE contact_id IS NULL;
    IF unlinked > 0 THEN
        RAISE EXCEPTION '0016: % wa_contacts rows have no owner or no usable phone; fix them before migrating', unlinked;
    END IF;

    -- Shared fields the contact doesn't have yet; tags are merged.
    UPDATE contacts c
    SET name       = coalesce(nullif(c.name, ''), nullif(w.name, '')),
        email      = coalesce(nullif(c.email, ''), nullif(w.email, '')),
        source     = coalesce(c.source, left(w.source, 50)),
        tags       = (SELECT coalesce(jsonb_agg(DISTINCT t), '[]'::jsonb)
                      FROM jsonb_array_elements(
                          CASE WHEN jsonb_typeof(c.tags) = 'array' THEN c.tags ELSE '[]'::jsonb END ||
                          CASE WHEN jsonb_typeof(w.tags) = 'array' THEN w.tags ELSE '[]'::jsonb END) t),
        updated_at = now()
    FROM (
        SELECT DISTINCT ON (contact_id) contact_id, name, email, source, tags
        FROM wa_contacts
        ORDER BY contact_id, updated_at DESC NULLS LAST
    ) w
    WHERE w.contact_id = c.id;

    ALTER TABLE wa_contacts RENAME TO whatsapp_contact_channels;
    ALTER TABLE whatsapp_contact_channels RENAME CONSTRAINT wa_contacts_pkey TO whatsapp_contact_channels_pkey;
    ALTER TABLE whatsapp_contact_channels RENAME CONSTRAINT contacts_store_external_unique TO whatsapp_contact_channels_store_external_unique;
    ALTER TABLE whatsapp_contact_channels RENAME CONSTRAINT wa_contacts_channel_id_channels_id_fk TO whatsapp_contact_channels_channel_id_channels_id_fk;
    ALTER TABLE whatsapp_contact_channels RENAME CONSTRAINT wa_contacts_store_id_shopify_stores_id_fk TO whatsapp_contact_channels_store_id_shopify_stores_id_fk;
    ALTER TABLE whatsapp_contact_channels RENAME CONSTRAINT wa_contacts_created_by_users_id_fk TO whatsapp_contact_channels_created_by_users_id_fk;
    ALTER INDEX wa_contacts_channel_idx RENAME TO whatsapp_contact_channels_channel_idx;
    ALTER INDEX wa_contacts_status_idx RENAME TO whatsapp_contact_channels_status_idx;
    ALTER INDEX wa_contacts_store_idx RENAME TO whatsapp_contact_channels_store_idx;
    ALTER INDEX wa_contacts_external_id_idx RENAME TO whatsapp_contact_channels_external_id_idx;
    ALTER INDEX wa_contacts_contact_id_idx RENAME TO whatsapp_contact_channels_contact_id_idx;

    ALTER TABLE abandoned_carts RENAME CONSTRAINT abandoned_carts_contact_id_wa_contacts_id_fk
        TO abandoned_carts_contact_id_whatsapp_contact_channels_id_fk;
    ALTER TABLE automation_executions RENAME CONSTRAINT automation_executions_contact_id_wa_contacts_id_fk
        TO automation_executions_contact_id_whatsapp_contact_channels_id_fk;
    ALTER TABLE conversations RENAME CONSTRAINT conversations_contact_id_wa_contacts_id_fk
        TO conversations_contact_id_whatsapp_contact_channels_id_fk;
    -- Postgres truncates this name to 63 characters, as it does when Drizzle creates it.
    ALTER TABLE wa_campaign_recipients RENAME CONSTRAINT wa_campaign_recipients_contact_id_wa_contacts_id_fk
        TO wa_campaign_recipients_contact_id_whatsapp_contact_channels_id_fk;

    ALTER TABLE whatsapp_contact_channels ADD COLUMN user_id varchar;
    UPDATE whatsapp_contact_channels d
    SET user_id    = c.user_id,
        created_at = coalesce(d.created_at, now()),
        updated_at = coalesce(d.updated_at, d.created_at, now())
    FROM contacts c
    WHERE c.id = d.contact_id;

    ALTER TABLE whatsapp_contact_channels
        DROP CONSTRAINT contacts_channel_phone_unique,
        DROP CONSTRAINT wa_contacts_contact_id_contacts_id_fk,
        DROP COLUMN tenant_id,
        DROP COLUMN name,
        DROP COLUMN phone,
        DROP COLUMN email,
        DROP COLUMN groups,
        DROP COLUMN tags,
        DROP COLUMN source,
        ALTER COLUMN user_id SET NOT NULL,
        ALTER COLUMN contact_id SET NOT NULL,
        ALTER COLUMN status SET DEFAULT 'active',
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN updated_at SET NOT NULL,
        ADD CONSTRAINT whatsapp_contact_channels_channel_contact_unique UNIQUE (channel_id, contact_id),
        ADD CONSTRAINT whatsapp_contact_channels_contact_id_contacts_id_fk
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT,
        ADD CONSTRAINT whatsapp_contact_channels_user_id_users_id_fk
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
END $$;

-- Fresh installs get the table from `npm run db:push`; nothing to do here then.

-- ---------------------------------------------------------------------------
-- 4. Indexes on the columns we filter by
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS whatsapp_contact_channels_user_id_idx ON whatsapp_contact_channels (user_id);
CREATE INDEX IF NOT EXISTS whatsapp_contact_channels_channel_created_idx
    ON whatsapp_contact_channels (channel_id, created_at);
CREATE INDEX IF NOT EXISTS contacts_user_created_idx ON contacts (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. Read-only view with the old wa_contacts column set
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW wa_contacts AS
SELECT d.id,
       d.channel_id,
       d.user_id AS tenant_id,
       coalesce(nullif(c.name, ''), c.phone) AS name,
       c.phone,
       c.email,
       coalesce((SELECT jsonb_agg(g.name ORDER BY g.name)
                 FROM contact_group_members m
                 JOIN contact_groups g ON g.id = m.group_id
                 WHERE m.contact_id = c.id AND g.user_id = d.user_id), '[]'::jsonb) AS groups,
       coalesce(c.tags, '[]'::jsonb) AS tags,
       d.status,
       c.source,
       d.store_id,
       d.external_id,
       d.last_contact,
       d.created_at,
       d.updated_at,
       d.created_by,
       d.contact_id,
       d.user_id
FROM whatsapp_contact_channels d
JOIN contacts c ON c.id = d.contact_id;

-- ---------------------------------------------------------------------------
-- 6. Every stored phone is E.164
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    bad int;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_phone_e164_check') THEN
        ALTER TABLE contacts ADD CONSTRAINT contacts_phone_e164_check
            CHECK (phone ~ '^\+[1-9][0-9]{7,14}$') NOT VALID;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_phone_e164_check' AND NOT convalidated) THEN
        SELECT count(*) INTO bad FROM contacts WHERE phone !~ '^\+[1-9][0-9]{7,14}$';
        IF bad = 0 THEN
            ALTER TABLE contacts VALIDATE CONSTRAINT contacts_phone_e164_check;
        ELSE
            RAISE NOTICE '0016: % existing contacts are not E.164; contacts_phone_e164_check stays NOT VALID', bad;
        END IF;
    END IF;
END $$;
