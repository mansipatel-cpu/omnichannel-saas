-- Stage 1 of the unified schema: one shared contact per person (per owner),
-- real contact groups, and links from every channel-specific contact row.
--
--   contacts (voice, per campaign)  -> renamed to campaign_contacts
--   contacts (new)                  -> shared person record, unique (user_id, phone)
--   contact_groups / contact_group_members -> replace the JSONB wa_contacts.groups array
--   wa_contacts.contact_id, campaign_contacts.contact_id, leads.contact_id -> contacts.id
--
-- Idempotent: run-safe-migration.mjs re-applies every file on each run.

-- ---------------------------------------------------------------------------
-- 1. Rename the voice per-campaign table (only while it still holds that shape)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.campaign_contacts') IS NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'campaign_id'
       ) THEN
        ALTER TABLE contacts RENAME TO campaign_contacts;
        ALTER TABLE campaign_contacts RENAME CONSTRAINT contacts_pkey TO campaign_contacts_pkey;
        ALTER TABLE campaign_contacts RENAME CONSTRAINT contacts_campaign_id_campaigns_id_fk TO campaign_contacts_campaign_id_campaigns_id_fk;
        ALTER INDEX IF EXISTS contacts_campaign_id_idx RENAME TO campaign_contacts_campaign_id_idx;
        ALTER INDEX IF EXISTS contacts_status_idx RENAME TO campaign_contacts_status_idx;
        ALTER INDEX IF EXISTS contacts_tenant_idx RENAME TO campaign_contacts_tenant_idx;
    END IF;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.campaign_contacts') IS NULL THEN
        RETURN;
    END IF;
    FOR r IN
        SELECT conrelid::regclass::text AS tbl, conname
        FROM pg_constraint
        WHERE contype = 'f'
          AND confrelid = 'public.campaign_contacts'::regclass
          AND conname LIKE '%\_contact\_id\_contacts\_id\_fk'
    LOOP
        EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
            r.tbl, r.conname, replace(r.conname, '_contact_id_contacts_id_fk', '_contact_id_campaign_contacts_id_fk'));
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Phone normalization (must match normalizePhone in contact-identity.service.js
--    and the copy in 0016): E.164 or NULL, 10-digit numbers are +91.
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

-- Account that owns data created by a user (must match ownerIdForUser in contact-identity.service.js)
CREATE OR REPLACE FUNCTION account_owner_id(uid varchar) RETURNS varchar
LANGUAGE sql STABLE AS $$
    SELECT CASE WHEN u.role = 'team' AND p.id IS NOT NULL THEN p.id ELSE u.id END
    FROM users u
    LEFT JOIN users p ON p.id = u.created_by
    WHERE u.id = uid
$$;

-- ---------------------------------------------------------------------------
-- 3. New tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
    id              varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone           text NOT NULL,
    name            text,
    first_name      text,
    last_name       text,
    email           text,
    custom_fields   jsonb DEFAULT '{}'::jsonb,
    tags            jsonb DEFAULT '[]'::jsonb,
    source          varchar(50),
    whatsapp_opt_in boolean NOT NULL DEFAULT true,
    do_not_call     boolean NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT contacts_user_phone_unique UNIQUE (user_id, phone)
);
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts (user_id);

CREATE TABLE IF NOT EXISTS contact_groups (
    id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id  varchar,
    name        varchar(255) NOT NULL,
    description text,
    created_by  varchar REFERENCES users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contact_groups_user_name_unique UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS contact_group_members (
    group_id   varchar NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
    contact_id varchar NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    added_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contact_group_members_group_id_contact_id_pk PRIMARY KEY (group_id, contact_id)
);
CREATE INDEX IF NOT EXISTS contact_group_members_contact_idx ON contact_group_members (contact_id);

-- ---------------------------------------------------------------------------
-- 4. Link columns
-- ---------------------------------------------------------------------------
ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS contact_id varchar;
ALTER TABLE leads             ADD COLUMN IF NOT EXISTS contact_id varchar;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_contacts_contact_id_contacts_id_fk') THEN
        ALTER TABLE campaign_contacts ADD CONSTRAINT campaign_contacts_contact_id_contacts_id_fk
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_contact_id_contacts_id_fk') THEN
        ALTER TABLE leads ADD CONSTRAINT leads_contact_id_contacts_id_fk
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaign_contacts_contact_id_idx ON campaign_contacts (contact_id);

-- wa_contacts is a view over whatsapp_contact_channels after 0016.
DO $$
BEGIN
    IF (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.wa_contacts')) IS DISTINCT FROM 'r' THEN
        RETURN;
    END IF;
    ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS contact_id varchar;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wa_contacts_contact_id_contacts_id_fk') THEN
        ALTER TABLE wa_contacts ADD CONSTRAINT wa_contacts_contact_id_contacts_id_fk
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
    END IF;
    CREATE INDEX IF NOT EXISTS wa_contacts_contact_id_idx ON wa_contacts (contact_id);
END $$;

-- ---------------------------------------------------------------------------
-- 5. Backfill shared contacts (merge by owner + normalized phone)
-- ---------------------------------------------------------------------------

-- 5a. Calling campaign contacts (owner = campaign owner)
INSERT INTO contacts (user_id, phone, name, first_name, last_name, email, custom_fields, source, created_at)
SELECT DISTINCT ON (ca.user_id, n.phone)
       ca.user_id, n.phone,
       NULLIF(btrim(concat_ws(' ', cc.first_name, cc.last_name)), ''),
       cc.first_name, cc.last_name, cc.email,
       coalesce(cc.custom_fields, '{}'::jsonb), 'calling_campaign', cc.created_at
FROM campaign_contacts cc
JOIN campaigns ca ON ca.id = cc.campaign_id
CROSS JOIN LATERAL (SELECT normalize_contact_phone(cc.phone) AS phone) n
WHERE cc.contact_id IS NULL AND n.phone IS NOT NULL
ORDER BY ca.user_id, n.phone, cc.created_at DESC
ON CONFLICT (user_id, phone) DO UPDATE SET
    first_name = coalesce(contacts.first_name, EXCLUDED.first_name),
    last_name  = coalesce(contacts.last_name, EXCLUDED.last_name),
    name       = coalesce(contacts.name, EXCLUDED.name),
    email      = coalesce(contacts.email, EXCLUDED.email);

UPDATE campaign_contacts cc
SET contact_id = c.id
FROM campaigns ca, contacts c
WHERE cc.contact_id IS NULL
  AND ca.id = cc.campaign_id
  AND c.user_id = ca.user_id
  AND c.phone = normalize_contact_phone(cc.phone);

-- 5b. WhatsApp contacts (owner = channel owner, else tenant, else creator's parent/self).
--     Only while wa_contacts is still a table; after 0016 every row is linked.
DO $$
BEGIN
IF (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.wa_contacts')) = 'r' THEN
WITH wa AS (
    SELECT w.*,
           coalesce(
               (SELECT u.id FROM users u WHERE u.id = ch.created_by),
               (SELECT u.id FROM users u WHERE u.id = w.tenant_id),
               account_owner_id(w.created_by)
           ) AS owner_id,
           normalize_contact_phone(w.phone) AS norm_phone
    FROM wa_contacts w
    LEFT JOIN channels ch ON ch.id = w.channel_id
    WHERE w.contact_id IS NULL
)
INSERT INTO contacts (user_id, phone, name, first_name, last_name, email, tags, source, created_at)
SELECT DISTINCT ON (owner_id, norm_phone)
       owner_id, norm_phone, NULLIF(btrim(name), ''),
       NULLIF(split_part(btrim(name), ' ', 1), ''),
       NULLIF(btrim(substr(btrim(name), length(split_part(btrim(name), ' ', 1)) + 1)), ''),
       email, coalesce(tags, '[]'::jsonb), coalesce(source, 'whatsapp'), created_at
FROM wa
WHERE owner_id IS NOT NULL AND norm_phone IS NOT NULL
ORDER BY owner_id, norm_phone, created_at DESC
ON CONFLICT (user_id, phone) DO UPDATE SET
    name       = coalesce(contacts.name, EXCLUDED.name),
    first_name = coalesce(contacts.first_name, EXCLUDED.first_name),
    last_name  = coalesce(contacts.last_name, EXCLUDED.last_name),
    email      = coalesce(contacts.email, EXCLUDED.email);

UPDATE wa_contacts w
SET contact_id = c.id
FROM (
    SELECT w2.id,
           coalesce(
               (SELECT u.id FROM users u WHERE u.id = ch.created_by),
               (SELECT u.id FROM users u WHERE u.id = w2.tenant_id),
               (SELECT coalesce(p.id, u.id) FROM users u LEFT JOIN users p ON p.id = u.created_by WHERE u.id = w2.created_by)
           ) AS owner_id
    FROM wa_contacts w2
    LEFT JOIN channels ch ON ch.id = w2.channel_id
    WHERE w2.contact_id IS NULL
) o, contacts c
WHERE w.id = o.id
  AND c.user_id = o.owner_id
  AND c.phone = normalize_contact_phone(w.phone);
END IF;
END $$;

-- 5c. CRM leads (owner = lead owner)
INSERT INTO contacts (user_id, phone, name, first_name, last_name, email, source, created_at)
SELECT DISTINCT ON (l.user_id, n.phone)
       l.user_id, n.phone,
       NULLIF(btrim(concat_ws(' ', l.first_name, l.last_name)), ''),
       l.first_name, l.last_name, l.email, 'lead', l.created_at
FROM leads l
CROSS JOIN LATERAL (SELECT normalize_contact_phone(l.phone) AS phone) n
WHERE l.contact_id IS NULL AND n.phone IS NOT NULL
ORDER BY l.user_id, n.phone, l.created_at DESC
ON CONFLICT (user_id, phone) DO UPDATE SET
    first_name = coalesce(contacts.first_name, EXCLUDED.first_name),
    last_name  = coalesce(contacts.last_name, EXCLUDED.last_name),
    name       = coalesce(contacts.name, EXCLUDED.name),
    email      = coalesce(contacts.email, EXCLUDED.email);

UPDATE leads l
SET contact_id = c.id
FROM contacts c
WHERE l.contact_id IS NULL
  AND c.user_id = l.user_id
  AND c.phone = normalize_contact_phone(l.phone);

-- ---------------------------------------------------------------------------
-- 6. Backfill groups from the legacy `groups` table and wa_contacts.groups JSONB
-- ---------------------------------------------------------------------------
INSERT INTO contact_groups (id, user_id, channel_id, name, description, created_by, created_at)
SELECT g.id,
       coalesce(
           (SELECT u.id FROM users u WHERE u.id = ch.created_by),
           account_owner_id(g.created_by)
       ),
       g."channelId"::text, g.name, g.description,
       (SELECT u.id FROM users u WHERE u.id = g.created_by),
       coalesce(g.created_at, now())
FROM groups g
LEFT JOIN channels ch ON ch.id = g."channelId"::text
WHERE coalesce(
          (SELECT u.id FROM users u WHERE u.id = ch.created_by),
          account_owner_id(g.created_by)
      ) IS NOT NULL
ON CONFLICT DO NOTHING;

-- Group names that only ever existed inside the JSONB array (wa_contacts.groups is
-- derived from memberships after 0016, so this only runs while it is a table)
DO $$
BEGIN
IF (SELECT relkind FROM pg_class WHERE oid = to_regclass('public.wa_contacts')) = 'r' THEN
INSERT INTO contact_groups (user_id, channel_id, name)
SELECT DISTINCT c.user_id, w.channel_id, btrim(elem)
FROM wa_contacts w
JOIN contacts c ON c.id = w.contact_id
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(w.groups) = 'array' THEN w.groups ELSE '[]'::jsonb END
) AS elem
WHERE btrim(elem) <> ''
  AND NOT EXISTS (SELECT 1 FROM groups g WHERE g.id = elem)
ON CONFLICT (user_id, name) DO NOTHING;

-- Memberships: array entries are group names (UI) or group ids (REST API v1)
INSERT INTO contact_group_members (group_id, contact_id)
SELECT DISTINCT cg.id, w.contact_id
FROM wa_contacts w
JOIN contacts c ON c.id = w.contact_id
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(w.groups) = 'array' THEN w.groups ELSE '[]'::jsonb END
) AS elem
JOIN contact_groups cg ON cg.user_id = c.user_id AND (cg.name = btrim(elem) OR cg.id = elem)
ON CONFLICT DO NOTHING;
END IF;
END $$;
