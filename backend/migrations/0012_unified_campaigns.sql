-- Stage 2 of the unified schema: one campaigns table and one campaign_recipients
-- table for every channel, with the channel-specific tables kept as 1:1 details.
--
--   campaigns (voice)            -> renamed to calling_campaigns (calling details)
--   wa_campaigns                 -> unchanged (WhatsApp details)
--   campaigns (new)              -> one row per campaign, channel = 'calling' | 'whatsapp'
--   campaign_recipients (WA)     -> renamed to wa_campaign_recipients (WhatsApp delivery details)
--   campaign_contacts            -> unchanged (calling attempt details)
--   campaign_recipients (new)    -> one row per recipient per campaign, linked to the shared contact
--
-- The detail tables keep the same id as their base row. Triggers on the detail
-- tables keep the base rows in sync inside the same transaction, so the
-- existing writers do not have to change.
--
-- Idempotent: run-safe-migration.mjs re-applies every file on each run.

-- ---------------------------------------------------------------------------
-- 1. Rename the voice campaigns table (only while it still holds that shape)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.calling_campaigns') IS NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'agent_id'
       ) THEN
        ALTER TABLE campaigns RENAME TO calling_campaigns;

        FOR r IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.calling_campaigns'::regclass AND conname LIKE 'campaigns\_%'
        LOOP
            EXECUTE format('ALTER TABLE calling_campaigns RENAME CONSTRAINT %I TO %I', r.conname, 'calling_' || r.conname);
        END LOOP;

        FOR r IN
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'calling_campaigns' AND indexname LIKE 'campaigns\_%'
        LOOP
            EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname, 'calling_' || r.indexname);
        END LOOP;

        FOR r IN
            SELECT conrelid::regclass::text AS tbl, conname
            FROM pg_constraint
            WHERE contype = 'f'
              AND confrelid = 'public.calling_campaigns'::regclass
              AND conname LIKE '%\_campaign\_id\_campaigns\_id\_fk'
        LOOP
            EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
                r.tbl, r.conname, replace(r.conname, '_campaign_id_campaigns_id_fk', '_campaign_id_calling_campaigns_id_fk'));
        END LOOP;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Rename the WhatsApp recipients table (only while it still holds that shape)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    IF to_regclass('public.wa_campaign_recipients') IS NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'campaign_recipients' AND column_name = 'whatsapp_message_id'
       ) THEN
        ALTER TABLE campaign_recipients RENAME TO wa_campaign_recipients;

        FOR r IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.wa_campaign_recipients'::regclass AND conname LIKE 'campaign\_recipients\_%'
        LOOP
            EXECUTE format('ALTER TABLE wa_campaign_recipients RENAME CONSTRAINT %I TO %I', r.conname, 'wa_' || r.conname);
        END LOOP;

        FOR r IN
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'wa_campaign_recipients' AND indexname LIKE 'campaign\_recipients\_%'
        LOOP
            EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname, 'wa_' || r.indexname);
        END LOOP;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Base tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
    id              varchar PRIMARY KEY,
    user_id         varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel         varchar(20) NOT NULL,
    name            text NOT NULL,
    status          text,
    scheduled_at    timestamptz,
    started_at      timestamptz,
    completed_at    timestamptz,
    recipient_count integer NOT NULL DEFAULT 0,
    created_by      varchar REFERENCES users(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    CONSTRAINT campaigns_channel_check CHECK (channel IN ('calling', 'whatsapp'))
);
CREATE INDEX IF NOT EXISTS campaigns_user_channel_idx ON campaigns (user_id, channel);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);
CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON campaigns (created_at);

CREATE TABLE IF NOT EXISTS campaign_recipients (
    id              varchar PRIMARY KEY,
    campaign_id     varchar NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id      varchar REFERENCES contacts(id) ON DELETE SET NULL,
    channel         varchar(20) NOT NULL,
    phone           text NOT NULL,
    name            text,
    status          text,
    attempt_count   integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz,
    next_retry_at   timestamptz,
    sent_at         timestamptz,
    delivered_at    timestamptz,
    read_at         timestamptz,
    error           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT campaign_recipients_channel_check CHECK (channel IN ('calling', 'whatsapp'))
);
CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_idx ON campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_recipients_contact_idx ON campaign_recipients (contact_id);
CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_status_idx ON campaign_recipients (campaign_id, status);

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------

-- Find or create the shared contact for (owner, phone); fills blanks, never overwrites.
-- Mirrors ensureSharedContact in contact-identity.service.js.
CREATE OR REPLACE FUNCTION ensure_shared_contact(
    p_owner varchar, p_phone text, p_name text, p_first text, p_last text, p_email text, p_source text
) RETURNS varchar
LANGUAGE plpgsql AS $$
DECLARE
    norm text := normalize_contact_phone(p_phone);
    cid  varchar;
BEGIN
    IF p_owner IS NULL OR norm IS NULL THEN
        RETURN NULL;
    END IF;
    INSERT INTO contacts (user_id, phone, name, first_name, last_name, email, source)
    VALUES (p_owner, norm, NULLIF(btrim(p_name), ''), NULLIF(btrim(p_first), ''), NULLIF(btrim(p_last), ''),
            NULLIF(btrim(p_email), ''), p_source)
    ON CONFLICT (user_id, phone) DO UPDATE SET
        name       = coalesce(contacts.name, EXCLUDED.name),
        first_name = coalesce(contacts.first_name, EXCLUDED.first_name),
        last_name  = coalesce(contacts.last_name, EXCLUDED.last_name),
        email      = coalesce(contacts.email, EXCLUDED.email),
        deleted_at = NULL,
        updated_at = now()
    RETURNING id INTO cid;
    RETURN cid;
END $$;

-- Voice tables store UTC in "timestamp without time zone" columns; accept either column type.
CREATE OR REPLACE FUNCTION as_utc_timestamptz(t timestamp) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$ SELECT t AT TIME ZONE 'UTC' $$;
CREATE OR REPLACE FUNCTION as_utc_timestamptz(t timestamptz) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$ SELECT t $$;

-- Owner account of a WhatsApp campaign: channel owner, else the creator's account.
CREATE OR REPLACE FUNCTION wa_campaign_owner_id(p_channel_id varchar, p_created_by varchar) RETURNS varchar
LANGUAGE sql STABLE AS $$
    SELECT coalesce(
        (SELECT u.id FROM channels ch JOIN users u ON u.id = ch.created_by WHERE ch.id = p_channel_id),
        account_owner_id(p_created_by),
        p_created_by
    )
$$;

-- ---------------------------------------------------------------------------
-- 5. Sync functions (detail row -> base row)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_calling_campaign() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM campaigns WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.user_id, NEW.name, NEW.status, NEW.scheduled_for, NEW.started_at, NEW.completed_at, NEW.total_contacts, NEW.deleted_at)
           IS NOT DISTINCT FROM
           (OLD.user_id, OLD.name, OLD.status, OLD.scheduled_for, OLD.started_at, OLD.completed_at, OLD.total_contacts, OLD.deleted_at) THEN
        RETURN NEW;
    END IF;
    INSERT INTO campaigns (id, user_id, channel, name, status, scheduled_at, started_at, completed_at,
                           recipient_count, created_by, created_at, updated_at, deleted_at)
    VALUES (NEW.id, NEW.user_id, 'calling', NEW.name, NEW.status,
            as_utc_timestamptz(NEW.scheduled_for), as_utc_timestamptz(NEW.started_at), as_utc_timestamptz(NEW.completed_at),
            coalesce(NEW.total_contacts, 0), NEW.user_id,
            coalesce(as_utc_timestamptz(NEW.created_at), now()), now(), as_utc_timestamptz(NEW.deleted_at))
    ON CONFLICT (id) DO UPDATE SET
        user_id         = EXCLUDED.user_id,
        name            = EXCLUDED.name,
        status          = EXCLUDED.status,
        scheduled_at    = EXCLUDED.scheduled_at,
        started_at      = EXCLUDED.started_at,
        completed_at    = EXCLUDED.completed_at,
        recipient_count = EXCLUDED.recipient_count,
        deleted_at      = EXCLUDED.deleted_at,
        updated_at      = now();
    RETURN NEW;
END $$;

-- WhatsApp campaigns are soft-deleted with status = 'deleted'.
CREATE OR REPLACE FUNCTION sync_wa_campaign() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM campaigns WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.channel_id, NEW.created_by, NEW.name, NEW.status, NEW.scheduled_at, NEW.completed_at, NEW.population_started_at, NEW.recipient_count)
           IS NOT DISTINCT FROM
           (OLD.channel_id, OLD.created_by, OLD.name, OLD.status, OLD.scheduled_at, OLD.completed_at, OLD.population_started_at, OLD.recipient_count) THEN
        RETURN NEW;
    END IF;
    INSERT INTO campaigns (id, user_id, channel, name, status, scheduled_at, started_at, completed_at,
                           recipient_count, created_by, created_at, updated_at, deleted_at)
    VALUES (NEW.id, wa_campaign_owner_id(NEW.channel_id, NEW.created_by), 'whatsapp', NEW.name, NEW.status,
            NEW.scheduled_at, NEW.population_started_at, NEW.completed_at,
            coalesce(NEW.recipient_count, 0), NEW.created_by,
            coalesce(NEW.created_at, now()), now(),
            CASE WHEN NEW.status = 'deleted' THEN coalesce(NEW.updated_at, now()) END)
    ON CONFLICT (id) DO UPDATE SET
        user_id         = EXCLUDED.user_id,
        name            = EXCLUDED.name,
        status          = EXCLUDED.status,
        scheduled_at    = EXCLUDED.scheduled_at,
        started_at      = EXCLUDED.started_at,
        completed_at    = EXCLUDED.completed_at,
        recipient_count = EXCLUDED.recipient_count,
        created_by      = EXCLUDED.created_by,
        deleted_at      = CASE WHEN EXCLUDED.status = 'deleted' THEN coalesce(campaigns.deleted_at, EXCLUDED.deleted_at) END,
        updated_at      = now();
    RETURN NEW;
END $$;

-- Links a calling recipient to its shared contact before the row is written.
CREATE OR REPLACE FUNCTION link_calling_recipient_contact() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.contact_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.phone IS DISTINCT FROM OLD.phone AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id) THEN
        NEW.contact_id := ensure_shared_contact(
            (SELECT user_id FROM calling_campaigns WHERE id = NEW.campaign_id),
            NEW.phone,
            concat_ws(' ', NEW.first_name, NEW.last_name),
            NEW.first_name, NEW.last_name, NEW.email, 'calling_campaign');
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION sync_calling_recipient() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM campaign_recipients WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.campaign_id, NEW.contact_id, NEW.phone, NEW.first_name, NEW.last_name, NEW.status,
            NEW.attempt_count, NEW.last_attempt_at, NEW.next_retry_at)
           IS NOT DISTINCT FROM
           (OLD.campaign_id, OLD.contact_id, OLD.phone, OLD.first_name, OLD.last_name, OLD.status,
            OLD.attempt_count, OLD.last_attempt_at, OLD.next_retry_at) THEN
        RETURN NEW;
    END IF;
    INSERT INTO campaign_recipients (id, campaign_id, contact_id, channel, phone, name, status,
                                     attempt_count, last_attempt_at, next_retry_at, created_at, updated_at)
    VALUES (NEW.id, NEW.campaign_id, NEW.contact_id, 'calling', NEW.phone,
            NULLIF(btrim(concat_ws(' ', NEW.first_name, NEW.last_name)), ''), NEW.status,
            coalesce(NEW.attempt_count, 0), as_utc_timestamptz(NEW.last_attempt_at), as_utc_timestamptz(NEW.next_retry_at),
            coalesce(as_utc_timestamptz(NEW.created_at), now()), now())
    ON CONFLICT (id) DO UPDATE SET
        campaign_id     = EXCLUDED.campaign_id,
        contact_id      = EXCLUDED.contact_id,
        phone           = EXCLUDED.phone,
        name            = EXCLUDED.name,
        status          = EXCLUDED.status,
        attempt_count   = EXCLUDED.attempt_count,
        last_attempt_at = EXCLUDED.last_attempt_at,
        next_retry_at   = EXCLUDED.next_retry_at,
        updated_at      = now();
    RETURN NEW;
END $$;

-- WhatsApp recipients point at wa_contacts (or nothing, for CSV campaigns);
-- the shared contact comes from that row, else from the campaign owner + phone.
CREATE OR REPLACE FUNCTION sync_wa_recipient() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    shared_id varchar;
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM campaign_recipients WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.campaign_id, NEW.contact_id, NEW.phone, NEW.name, NEW.status, NEW.sent_at, NEW.delivered_at,
            NEW.read_at, NEW.error_code, NEW.error_message, NEW.retry_count)
           IS NOT DISTINCT FROM
           (OLD.campaign_id, OLD.contact_id, OLD.phone, OLD.name, OLD.status, OLD.sent_at, OLD.delivered_at,
            OLD.read_at, OLD.error_code, OLD.error_message, OLD.retry_count) THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.contact_id IS DISTINCT FROM OLD.contact_id OR NEW.phone IS DISTINCT FROM OLD.phone THEN
        SELECT w.contact_id INTO shared_id FROM wa_contacts w WHERE w.id = NEW.contact_id;
        IF shared_id IS NULL THEN
            shared_id := ensure_shared_contact(
                (SELECT user_id FROM campaigns WHERE id = NEW.campaign_id),
                NEW.phone, NEW.name, NULL, NULL, NULL, 'whatsapp_campaign');
        END IF;
    END IF;
    INSERT INTO campaign_recipients (id, campaign_id, contact_id, channel, phone, name, status, attempt_count,
                                     last_attempt_at, sent_at, delivered_at, read_at, error, created_at, updated_at)
    VALUES (NEW.id, NEW.campaign_id, shared_id, 'whatsapp', NEW.phone, NEW.name, NEW.status,
            coalesce(NEW.retry_count, 0) + CASE WHEN coalesce(NEW.status, 'pending') = 'pending' THEN 0 ELSE 1 END,
            NEW.sent_at, NEW.sent_at, NEW.delivered_at, NEW.read_at,
            NULLIF(concat_ws(': ', NEW.error_code, NEW.error_message), ''),
            coalesce(NEW.created_at, now()), now())
    ON CONFLICT (id) DO UPDATE SET
        campaign_id     = EXCLUDED.campaign_id,
        contact_id      = coalesce(EXCLUDED.contact_id, campaign_recipients.contact_id),
        phone           = EXCLUDED.phone,
        name            = EXCLUDED.name,
        status          = EXCLUDED.status,
        attempt_count   = EXCLUDED.attempt_count,
        last_attempt_at = EXCLUDED.last_attempt_at,
        sent_at         = EXCLUDED.sent_at,
        delivered_at    = EXCLUDED.delivered_at,
        read_at         = EXCLUDED.read_at,
        error           = EXCLUDED.error,
        updated_at      = now();
    RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Backfill base rows from the detail tables
-- ---------------------------------------------------------------------------
INSERT INTO campaigns (id, user_id, channel, name, status, scheduled_at, started_at, completed_at,
                       recipient_count, created_by, created_at, updated_at, deleted_at)
SELECT c.id, c.user_id, 'calling', c.name, c.status,
       as_utc_timestamptz(c.scheduled_for), as_utc_timestamptz(c.started_at), as_utc_timestamptz(c.completed_at),
       coalesce(c.total_contacts, 0), c.user_id,
       coalesce(as_utc_timestamptz(c.created_at), now()), now(), as_utc_timestamptz(c.deleted_at)
FROM calling_campaigns c
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaigns (id, user_id, channel, name, status, scheduled_at, started_at, completed_at,
                       recipient_count, created_by, created_at, updated_at, deleted_at)
SELECT w.id, o.owner_id, 'whatsapp', w.name, w.status,
       w.scheduled_at, w.population_started_at, w.completed_at,
       coalesce(w.recipient_count, 0), w.created_by,
       coalesce(w.created_at, now()), now(),
       CASE WHEN w.status = 'deleted' THEN coalesce(w.updated_at, now()) END
FROM wa_campaigns w
CROSS JOIN LATERAL (SELECT wa_campaign_owner_id(w.channel_id, w.created_by) AS owner_id) o
WHERE o.owner_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

UPDATE campaign_contacts cc
SET contact_id = ensure_shared_contact(ca.user_id, cc.phone, concat_ws(' ', cc.first_name, cc.last_name),
                                       cc.first_name, cc.last_name, cc.email, 'calling_campaign')
FROM calling_campaigns ca
WHERE cc.contact_id IS NULL AND ca.id = cc.campaign_id;

INSERT INTO campaign_recipients (id, campaign_id, contact_id, channel, phone, name, status,
                                 attempt_count, last_attempt_at, next_retry_at, created_at, updated_at)
SELECT cc.id, cc.campaign_id, cc.contact_id, 'calling', cc.phone,
       NULLIF(btrim(concat_ws(' ', cc.first_name, cc.last_name)), ''), cc.status,
       coalesce(cc.attempt_count, 0), as_utc_timestamptz(cc.last_attempt_at), as_utc_timestamptz(cc.next_retry_at),
       coalesce(as_utc_timestamptz(cc.created_at), now()), now()
FROM campaign_contacts cc
JOIN campaigns b ON b.id = cc.campaign_id
ON CONFLICT (id) DO NOTHING;

-- WhatsApp contacts live in whatsapp_contact_channels after 0016 (same ids).
DO $$
BEGIN
IF to_regclass('public.whatsapp_contact_channels') IS NOT NULL THEN
    INSERT INTO campaign_recipients (id, campaign_id, contact_id, channel, phone, name, status, attempt_count,
                                     last_attempt_at, sent_at, delivered_at, read_at, error, created_at, updated_at)
    SELECT r.id, r.campaign_id,
           coalesce(w.contact_id, ensure_shared_contact(b.user_id, r.phone, r.name, NULL, NULL, NULL, 'whatsapp_campaign')),
           'whatsapp', r.phone, r.name, r.status,
           coalesce(r.retry_count, 0) + CASE WHEN coalesce(r.status, 'pending') = 'pending' THEN 0 ELSE 1 END,
           r.sent_at, r.sent_at, r.delivered_at, r.read_at,
           NULLIF(concat_ws(': ', r.error_code, r.error_message), ''),
           coalesce(r.created_at, now()), now()
    FROM wa_campaign_recipients r
    JOIN campaigns b ON b.id = r.campaign_id
    LEFT JOIN whatsapp_contact_channels w ON w.id = r.contact_id
    WHERE NOT EXISTS (SELECT 1 FROM campaign_recipients x WHERE x.id = r.id);
ELSE
    INSERT INTO campaign_recipients (id, campaign_id, contact_id, channel, phone, name, status, attempt_count,
                                     last_attempt_at, sent_at, delivered_at, read_at, error, created_at, updated_at)
    SELECT r.id, r.campaign_id,
           coalesce(w.contact_id, ensure_shared_contact(b.user_id, r.phone, r.name, NULL, NULL, NULL, 'whatsapp_campaign')),
           'whatsapp', r.phone, r.name, r.status,
           coalesce(r.retry_count, 0) + CASE WHEN coalesce(r.status, 'pending') = 'pending' THEN 0 ELSE 1 END,
           r.sent_at, r.sent_at, r.delivered_at, r.read_at,
           NULLIF(concat_ws(': ', r.error_code, r.error_message), ''),
           coalesce(r.created_at, now()), now()
    FROM wa_campaign_recipients r
    JOIN campaigns b ON b.id = r.campaign_id
    LEFT JOIN wa_contacts w ON w.id = r.contact_id
    WHERE NOT EXISTS (SELECT 1 FROM campaign_recipients x WHERE x.id = r.id);
END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. 1:1 links from detail rows to base rows (checked at commit, because the
--    base row is written by the AFTER trigger of the same statement)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calling_campaigns_id_campaigns_id_fk') THEN
        ALTER TABLE calling_campaigns ADD CONSTRAINT calling_campaigns_id_campaigns_id_fk
            FOREIGN KEY (id) REFERENCES campaigns(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wa_campaigns_id_campaigns_id_fk') THEN
        ALTER TABLE wa_campaigns ADD CONSTRAINT wa_campaigns_id_campaigns_id_fk
            FOREIGN KEY (id) REFERENCES campaigns(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_contacts_id_campaign_recipients_id_fk') THEN
        ALTER TABLE campaign_contacts ADD CONSTRAINT campaign_contacts_id_campaign_recipients_id_fk
            FOREIGN KEY (id) REFERENCES campaign_recipients(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wa_campaign_recipients_id_campaign_recipients_id_fk') THEN
        ALTER TABLE wa_campaign_recipients ADD CONSTRAINT wa_campaign_recipients_id_campaign_recipients_id_fk
            FOREIGN KEY (id) REFERENCES campaign_recipients(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS calling_campaigns_sync ON calling_campaigns;
CREATE TRIGGER calling_campaigns_sync
    AFTER INSERT OR UPDATE OR DELETE ON calling_campaigns
    FOR EACH ROW EXECUTE FUNCTION sync_calling_campaign();

DROP TRIGGER IF EXISTS wa_campaigns_sync ON wa_campaigns;
CREATE TRIGGER wa_campaigns_sync
    AFTER INSERT OR UPDATE OR DELETE ON wa_campaigns
    FOR EACH ROW EXECUTE FUNCTION sync_wa_campaign();

DROP TRIGGER IF EXISTS campaign_contacts_link_contact ON campaign_contacts;
CREATE TRIGGER campaign_contacts_link_contact
    BEFORE INSERT OR UPDATE OF phone, contact_id ON campaign_contacts
    FOR EACH ROW EXECUTE FUNCTION link_calling_recipient_contact();

DROP TRIGGER IF EXISTS campaign_contacts_sync ON campaign_contacts;
CREATE TRIGGER campaign_contacts_sync
    AFTER INSERT OR UPDATE OR DELETE ON campaign_contacts
    FOR EACH ROW EXECUTE FUNCTION sync_calling_recipient();

DROP TRIGGER IF EXISTS wa_campaign_recipients_sync ON wa_campaign_recipients;
CREATE TRIGGER wa_campaign_recipients_sync
    AFTER INSERT OR UPDATE OR DELETE ON wa_campaign_recipients
    FOR EACH ROW EXECUTE FUNCTION sync_wa_recipient();
