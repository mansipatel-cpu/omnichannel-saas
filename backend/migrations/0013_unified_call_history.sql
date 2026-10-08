-- Stage 3 of the unified schema: one call_history row per real phone call,
-- whichever provider handled it.
--
--   calls                -> unchanged (campaign placeholders + ElevenLabs/Twilio/widget calls)
--   plivo_calls          -> unchanged (Plivo details)      + call_history_id
--   sip_calls            -> unchanged (SIP details)        + call_history_id
--   twilio_openai_calls  -> unchanged (Twilio+OpenAI details) + call_history_id
--   call_history (new)   -> one row per call, linked to the shared contact,
--                           campaign, campaign recipient and the detail rows
--   leads.call_history_id (new) -> the one call a lead came from
--
-- A campaign creates a `calls` placeholder per contact before the provider
-- writes its own row. The provider row takes over the placeholder's
-- call_history row (same campaign + recipient) instead of adding a second one.
-- Sync failures are logged as warnings and never block the call write.
--
-- Idempotent: run-safe-migration.mjs re-applies every file on each run.

-- ---------------------------------------------------------------------------
-- 1. Table and link columns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_history (
    id                    varchar PRIMARY KEY,
    user_id               varchar REFERENCES users(id) ON DELETE CASCADE,
    contact_id            varchar REFERENCES contacts(id) ON DELETE SET NULL,
    campaign_id           varchar REFERENCES campaigns(id) ON DELETE CASCADE,
    campaign_recipient_id varchar REFERENCES campaign_recipients(id) ON DELETE SET NULL,
    call_id               varchar REFERENCES calls(id) ON DELETE SET NULL,
    provider              varchar(40) NOT NULL,
    provider_table        varchar(40),
    provider_row_id       varchar,
    provider_call_id      text,
    agent_id              varchar,
    direction             varchar(10),
    from_number           text,
    to_number             text,
    status                text,
    duration_seconds      integer,
    recording_url         text,
    transcript            text,
    ai_summary            text,
    sentiment             text,
    classification        text,
    credits_used          numeric,
    started_at            timestamptz,
    answered_at           timestamptz,
    ended_at              timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_history_user_created_idx ON call_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_history_contact_idx ON call_history (contact_id);
CREATE INDEX IF NOT EXISTS call_history_campaign_recipient_idx ON call_history (campaign_id, campaign_recipient_id);
CREATE INDEX IF NOT EXISTS call_history_call_id_idx ON call_history (call_id);
CREATE INDEX IF NOT EXISTS call_history_provider_row_idx ON call_history (provider_table, provider_row_id);
CREATE INDEX IF NOT EXISTS call_history_provider_call_idx ON call_history (provider_table, provider_call_id);

ALTER TABLE plivo_calls         ADD COLUMN IF NOT EXISTS call_history_id varchar;
ALTER TABLE sip_calls           ADD COLUMN IF NOT EXISTS call_history_id varchar;
ALTER TABLE twilio_openai_calls ADD COLUMN IF NOT EXISTS call_history_id varchar;
ALTER TABLE leads               ADD COLUMN IF NOT EXISTS call_history_id varchar;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['plivo_calls', 'sip_calls', 'twilio_openai_calls', 'leads'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_call_history_id_call_history_id_fk') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (call_history_id) REFERENCES call_history(id) ON DELETE SET NULL',
                t, t || '_call_history_id_call_history_id_fk');
        END IF;
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (call_history_id)', t || '_call_history_id_idx', t);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Core upsert (shared by every source table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_call_history(
    p_history_id       varchar,  -- link already stored on the provider row
    p_call_id          varchar,  -- calls.id when the source is the calls table
    p_provider         text,
    p_provider_table   text,     -- NULL when the source is the calls table
    p_provider_row_id  varchar,
    p_provider_call_id text,
    p_user_id          varchar,
    p_campaign_id      varchar,
    p_recipient_id     varchar,
    p_agent_id         varchar,
    p_direction        text,
    p_from             text,
    p_to               text,
    p_status           text,
    p_duration         integer,
    p_recording        text,
    p_transcript       text,
    p_summary          text,
    p_sentiment        text,
    p_classification   text,
    p_credits          numeric,
    p_started          timestamptz,
    p_answered         timestamptz,
    p_ended            timestamptz,
    p_created          timestamptz
) RETURNS varchar
LANGUAGE plpgsql AS $$
DECLARE
    hid         varchar;
    campaign    varchar := (SELECT id FROM campaigns WHERE id = p_campaign_id);
    recipient   varchar := (SELECT id FROM campaign_recipients WHERE id = p_recipient_id);
    v_owner     varchar;
    person      varchar;
    dir         text := CASE
                            WHEN p_direction IS NULL THEN NULL
                            WHEN lower(p_direction) IN ('incoming', 'inbound') THEN 'inbound'
                            ELSE 'outbound'
                        END;
BEGIN
    IF p_provider_table IS NULL THEN
        SELECT id INTO hid FROM call_history WHERE id = p_call_id OR call_id = p_call_id LIMIT 1;
    ELSE
        IF p_history_id IS NOT NULL THEN
            SELECT id INTO hid FROM call_history WHERE id = p_history_id;
        END IF;
        IF hid IS NULL THEN
            SELECT id INTO hid FROM call_history
            WHERE provider_table = p_provider_table AND provider_row_id = p_provider_row_id LIMIT 1;
        END IF;
        IF hid IS NULL AND p_provider_call_id IS NOT NULL THEN
            SELECT id INTO hid FROM call_history
            WHERE provider_table = p_provider_table AND provider_call_id = p_provider_call_id
            ORDER BY created_at DESC LIMIT 1;
        END IF;
        IF hid IS NULL AND campaign IS NOT NULL AND recipient IS NOT NULL THEN
            SELECT id INTO hid FROM call_history
            WHERE provider_row_id IS NULL AND call_id IS NOT NULL
              AND campaign_id = campaign AND campaign_recipient_id = recipient
            ORDER BY created_at DESC LIMIT 1;
        END IF;
    END IF;

    v_owner := coalesce((SELECT id FROM users WHERE id = p_user_id),
                      (SELECT user_id FROM campaigns WHERE id = campaign));
    person := coalesce(
        (SELECT contact_id FROM campaign_recipients WHERE id = recipient),
        (SELECT c.id FROM contacts c
         WHERE c.user_id = v_owner AND c.deleted_at IS NULL
           AND c.phone = normalize_contact_phone(CASE WHEN dir = 'inbound' THEN p_from ELSE p_to END)));

    IF hid IS NULL THEN
        hid := coalesce(p_provider_row_id, p_call_id);
        INSERT INTO call_history (id, user_id, contact_id, campaign_id, campaign_recipient_id, call_id,
                                  provider, provider_table, provider_row_id, provider_call_id, agent_id,
                                  direction, from_number, to_number, status, duration_seconds, recording_url,
                                  transcript, ai_summary, sentiment, classification, credits_used,
                                  started_at, answered_at, ended_at, created_at, updated_at)
        VALUES (hid, v_owner, person, campaign, recipient, p_call_id,
                p_provider, p_provider_table, p_provider_row_id, p_provider_call_id, p_agent_id,
                dir, p_from, p_to, p_status, p_duration, p_recording,
                p_transcript, p_summary, p_sentiment, p_classification, p_credits,
                p_started, p_answered, p_ended, coalesce(p_created, now()), now())
        ON CONFLICT (id) DO NOTHING;
        RETURN hid;
    END IF;

    IF p_provider_table IS NULL THEN
        -- A placeholder only feeds the row until a provider row takes it over.
        UPDATE call_history SET call_id = p_call_id WHERE id = hid AND call_id IS DISTINCT FROM p_call_id;
        UPDATE call_history h SET
            user_id               = coalesce(v_owner, h.user_id),
            contact_id            = coalesce(person, h.contact_id),
            campaign_id           = coalesce(campaign, h.campaign_id),
            campaign_recipient_id = coalesce(recipient, h.campaign_recipient_id),
            provider              = p_provider,
            provider_call_id      = coalesce(p_provider_call_id, h.provider_call_id),
            agent_id              = coalesce(p_agent_id, h.agent_id),
            direction             = coalesce(dir, h.direction),
            from_number           = coalesce(p_from, h.from_number),
            to_number             = coalesce(p_to, h.to_number),
            status                = coalesce(p_status, h.status),
            duration_seconds      = coalesce(p_duration, h.duration_seconds),
            recording_url         = coalesce(p_recording, h.recording_url),
            transcript            = coalesce(p_transcript, h.transcript),
            ai_summary            = coalesce(p_summary, h.ai_summary),
            sentiment             = coalesce(p_sentiment, h.sentiment),
            classification        = coalesce(p_classification, h.classification),
            credits_used          = coalesce(p_credits, h.credits_used),
            started_at            = coalesce(p_started, h.started_at),
            answered_at           = coalesce(p_answered, h.answered_at),
            ended_at              = coalesce(p_ended, h.ended_at),
            updated_at            = now()
        WHERE h.id = hid AND h.provider_row_id IS NULL;
    ELSE
        UPDATE call_history h SET
            user_id               = coalesce(v_owner, h.user_id),
            contact_id            = coalesce(person, h.contact_id),
            campaign_id           = coalesce(campaign, h.campaign_id),
            campaign_recipient_id = coalesce(recipient, h.campaign_recipient_id),
            provider              = p_provider,
            provider_table        = p_provider_table,
            provider_row_id       = p_provider_row_id,
            provider_call_id      = coalesce(p_provider_call_id, h.provider_call_id),
            agent_id              = coalesce(p_agent_id, h.agent_id),
            direction             = coalesce(dir, h.direction),
            from_number           = coalesce(p_from, h.from_number),
            to_number             = coalesce(p_to, h.to_number),
            status                = coalesce(p_status, h.status),
            duration_seconds      = coalesce(p_duration, h.duration_seconds),
            recording_url         = coalesce(p_recording, h.recording_url),
            transcript            = coalesce(p_transcript, h.transcript),
            ai_summary            = coalesce(p_summary, h.ai_summary),
            sentiment             = coalesce(p_sentiment, h.sentiment),
            classification        = coalesce(p_classification, h.classification),
            credits_used          = coalesce(p_credits, h.credits_used),
            started_at            = coalesce(p_started, h.started_at),
            answered_at           = coalesce(p_answered, h.answered_at),
            ended_at              = coalesce(p_ended, h.ended_at),
            updated_at            = now()
        WHERE h.id = hid;
    END IF;
    RETURN hid;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Per-table mappers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION call_history_from_calls(c calls) RETURNS varchar
LANGUAGE plpgsql AS $$
DECLARE
    incoming boolean := lower(coalesce(c.call_direction, '')) IN ('incoming', 'inbound');
BEGIN
    RETURN upsert_call_history(
        NULL, c.id,
        replace(coalesce(c.metadata->>'telephonyProvider', c.engine_type,
                         CASE WHEN c.widget_id IS NOT NULL THEN 'widget'
                              WHEN c.twilio_sid IS NOT NULL THEN 'twilio'
                              ELSE 'elevenlabs' END), 'twilio-openai', 'twilio_openai'),
        NULL, NULL, coalesce(c.elevenlabs_conversation_id, c.twilio_sid),
        c.user_id, c.campaign_id, c.contact_id, c.agent_id, c.call_direction,
        coalesce(c.from_number, CASE WHEN incoming THEN c.phone_number END),
        coalesce(c.to_number, CASE WHEN NOT incoming THEN c.phone_number END),
        c.status, c.duration, c.recording_url, c.transcript, c.ai_summary, c.sentiment, c.classification,
        c.credits_used,
        as_utc_timestamptz(c.started_at), NULL, as_utc_timestamptz(c.ended_at), as_utc_timestamptz(c.created_at));
END $$;

CREATE OR REPLACE FUNCTION call_history_from_plivo(p plivo_calls) RETURNS varchar
LANGUAGE plpgsql AS $$
BEGIN
    RETURN upsert_call_history(
        p.call_history_id, NULL, 'plivo', 'plivo_calls', p.id, p.plivo_call_uuid,
        p.user_id, p.campaign_id, p.contact_id, p.agent_id, p.call_direction, p.from_number, p.to_number,
        p.status, p.duration, p.recording_url, p.transcript, p.ai_summary, p.sentiment, p.classification, NULL,
        as_utc_timestamptz(p.started_at), as_utc_timestamptz(p.answered_at), as_utc_timestamptz(p.ended_at),
        as_utc_timestamptz(p.created_at));
END $$;

CREATE OR REPLACE FUNCTION call_history_from_twilio_openai(t twilio_openai_calls) RETURNS varchar
LANGUAGE plpgsql AS $$
BEGIN
    RETURN upsert_call_history(
        t.call_history_id, NULL, 'twilio_openai', 'twilio_openai_calls', t.id, t.twilio_call_sid,
        t.user_id, t.campaign_id, t.contact_id, t.agent_id, t.call_direction, t.from_number, t.to_number,
        t.status, t.duration, t.recording_url, t.transcript, t.ai_summary, t.sentiment, t.classification, NULL,
        as_utc_timestamptz(t.started_at), as_utc_timestamptz(t.answered_at), as_utc_timestamptz(t.ended_at),
        as_utc_timestamptz(t.created_at));
END $$;

CREATE OR REPLACE FUNCTION call_history_from_sip(s sip_calls) RETURNS varchar
LANGUAGE plpgsql AS $$
BEGIN
    RETURN upsert_call_history(
        s.call_history_id, NULL, coalesce(s.engine, 'sip'), 'sip_calls', s.id,
        coalesce(s.elevenlabs_conversation_id, s.external_call_id, s.openai_call_id),
        s.user_id, s.campaign_id, s.contact_id, s.agent_id, s.direction, s.from_number, s.to_number,
        s.status, s.duration_seconds, s.recording_url, s.transcript::text, s.ai_summary, s.sentiment, s.classification,
        s.credits_used,
        as_utc_timestamptz(s.started_at), as_utc_timestamptz(s.answered_at), as_utc_timestamptz(s.ended_at),
        as_utc_timestamptz(s.created_at));
END $$;

-- ---------------------------------------------------------------------------
-- 4. Trigger functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calls_sync_call_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM call_history WHERE id = OLD.id AND provider_row_id IS NULL;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.user_id, NEW.campaign_id, NEW.contact_id, NEW.agent_id, NEW.status, NEW.call_direction, NEW.duration,
            NEW.recording_url, NEW.transcript, NEW.ai_summary, NEW.sentiment, NEW.classification, NEW.twilio_sid,
            NEW.elevenlabs_conversation_id, NEW.phone_number, NEW.from_number, NEW.to_number, NEW.credits_used,
            NEW.started_at, NEW.ended_at, NEW.engine_type, NEW.metadata->>'telephonyProvider')
           IS NOT DISTINCT FROM
           (OLD.user_id, OLD.campaign_id, OLD.contact_id, OLD.agent_id, OLD.status, OLD.call_direction, OLD.duration,
            OLD.recording_url, OLD.transcript, OLD.ai_summary, OLD.sentiment, OLD.classification, OLD.twilio_sid,
            OLD.elevenlabs_conversation_id, OLD.phone_number, OLD.from_number, OLD.to_number, OLD.credits_used,
            OLD.started_at, OLD.ended_at, OLD.engine_type, OLD.metadata->>'telephonyProvider') THEN
        RETURN NEW;
    END IF;
    BEGIN
        PERFORM call_history_from_calls(NEW);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'call_history sync skipped for calls %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END $$;

-- Provider rows: BEFORE INSERT/UPDATE so the link is stored on the row itself.
CREATE OR REPLACE FUNCTION plivo_calls_sync_call_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        NEW.call_history_id := call_history_from_plivo(NEW);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'call_history sync skipped for plivo_calls %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION twilio_openai_calls_sync_call_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        NEW.call_history_id := call_history_from_twilio_openai(NEW);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'call_history sync skipped for twilio_openai_calls %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION sip_calls_sync_call_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        NEW.call_history_id := call_history_from_sip(NEW);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'call_history sync skipped for sip_calls %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION provider_call_unlink_call_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM call_history WHERE id = OLD.id;
    UPDATE call_history SET provider_table = NULL, provider_row_id = NULL, updated_at = now()
    WHERE provider_table = TG_TABLE_NAME AND provider_row_id = OLD.id;
    RETURN OLD;
END $$;

-- Leads keep their four provider-specific call columns; call_history_id is the one to read.
CREATE OR REPLACE FUNCTION leads_link_call_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.call_history_id := coalesce(
        (SELECT id FROM call_history WHERE provider_table = 'twilio_openai_calls' AND provider_row_id = NEW.twilio_openai_call_id LIMIT 1),
        (SELECT id FROM call_history WHERE provider_table = 'plivo_calls' AND provider_row_id = NEW.plivo_call_id LIMIT 1),
        (SELECT id FROM call_history WHERE provider_table = 'sip_calls' AND provider_row_id = NEW.sip_call_id LIMIT 1),
        (SELECT id FROM call_history WHERE id = NEW.call_id OR call_id = NEW.call_id LIMIT 1),
        NEW.call_history_id);
    RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Backfill call_history from calls (placeholders first, so provider rows can take them over)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    r calls;
BEGIN
    FOR r IN
        SELECT c.* FROM calls c
        WHERE NOT EXISTS (SELECT 1 FROM call_history h WHERE h.id = c.id OR h.call_id = c.id)
        ORDER BY c.created_at
    LOOP
        BEGIN
            PERFORM call_history_from_calls(r);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'call_history backfill skipped for calls %: %', r.id, SQLERRM;
        END;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS calls_sync_call_history ON calls;
CREATE TRIGGER calls_sync_call_history
    AFTER INSERT OR UPDATE OR DELETE ON calls
    FOR EACH ROW EXECUTE FUNCTION calls_sync_call_history();

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['plivo_calls', 'sip_calls', 'twilio_openai_calls'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_sync_call_history', t);
        EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION %I()',
            t || '_sync_call_history', t, t || '_sync_call_history');
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_unlink_call_history', t);
        EXECUTE format('CREATE TRIGGER %I AFTER DELETE ON %I FOR EACH ROW EXECUTE FUNCTION provider_call_unlink_call_history()',
            t || '_unlink_call_history', t);
    END LOOP;
END $$;

DROP TRIGGER IF EXISTS leads_link_call_history ON leads;
CREATE TRIGGER leads_link_call_history
    BEFORE INSERT OR UPDATE OF call_id, plivo_call_id, sip_call_id, twilio_openai_call_id, call_history_id ON leads
    FOR EACH ROW EXECUTE FUNCTION leads_link_call_history();

-- ---------------------------------------------------------------------------
-- 7. Backfill provider rows and leads (the triggers above do the linking)
-- ---------------------------------------------------------------------------
UPDATE plivo_calls         SET call_history_id = call_history_id WHERE call_history_id IS NULL;
UPDATE twilio_openai_calls SET call_history_id = call_history_id WHERE call_history_id IS NULL;
UPDATE sip_calls           SET call_history_id = call_history_id WHERE call_history_id IS NULL;
UPDATE leads SET call_history_id = call_history_id
WHERE call_history_id IS NULL
  AND (call_id IS NOT NULL OR plivo_call_id IS NOT NULL OR sip_call_id IS NOT NULL OR twilio_openai_call_id IS NOT NULL);
