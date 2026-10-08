-- Stage 4a of the unified schema: one plans list, one subscriptions list and one
-- payments list for every channel.
--
--   plans                 (calling)  ┐
--   wa_plans              (whatsapp) ┘-> billing_plans         (+ channel)
--   user_subscriptions    (calling)  ┐
--   subscriptions         (whatsapp) ┘-> billing_subscriptions (+ channel)
--   payment_transactions  (calling)  ┐
--   transactions          (whatsapp) ┘-> billing_payments      (+ channel)
--
-- Structure only: every account still has one calling plan and one WhatsApp plan,
-- and checkout, gateways and limits keep using the per-channel tables. The
-- billing_* tables use the same ids as their source rows and are written only by
-- the triggers below. Gateway price/plan ids stay in the source tables.
-- Sync failures are logged as warnings and never block the billing write.
--
-- Idempotent: run-safe-migration.mjs re-applies every file on each run.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS billing_plans (
    id            varchar PRIMARY KEY,
    channel       varchar(20) NOT NULL CHECK (channel IN ('calling', 'whatsapp')),
    name          text NOT NULL,
    display_name  text,
    description   text,
    monthly_price numeric,
    yearly_price  numeric,
    limits        jsonb NOT NULL DEFAULT '{}'::jsonb,
    features      jsonb,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_plans_channel_idx ON billing_plans (channel);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id                      varchar PRIMARY KEY,
    user_id                 varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel                 varchar(20) NOT NULL CHECK (channel IN ('calling', 'whatsapp')),
    plan_id                 varchar REFERENCES billing_plans(id) ON DELETE SET NULL,
    status                  text NOT NULL,
    billing_cycle           varchar(20),
    current_period_start    timestamptz,
    current_period_end      timestamptz,
    cancel_at_period_end    boolean NOT NULL DEFAULT false,
    gateway                 varchar(40),
    gateway_subscription_id text,
    plan_snapshot           jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_subscriptions_user_channel_idx ON billing_subscriptions (user_id, channel);
CREATE INDEX IF NOT EXISTS billing_subscriptions_plan_idx ON billing_subscriptions (plan_id);

CREATE TABLE IF NOT EXISTS billing_payments (
    id                     varchar PRIMARY KEY,
    user_id                varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel                varchar(20) NOT NULL CHECK (channel IN ('calling', 'whatsapp')),
    type                   text,
    plan_id                varchar REFERENCES billing_plans(id) ON DELETE SET NULL,
    subscription_id        varchar REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
    credit_package_id      varchar,
    gateway                varchar(40),
    gateway_transaction_id text,
    amount                 numeric NOT NULL,
    currency               text,
    billing_cycle          varchar(20),
    status                 text NOT NULL,
    description            text,
    credits_awarded        integer,
    metadata               jsonb,
    paid_at                timestamptz,
    refunded_at            timestamptz,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_payments_user_created_idx ON billing_payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_payments_subscription_idx ON billing_payments (subscription_id);
CREATE INDEX IF NOT EXISTS billing_payments_gateway_txn_idx ON billing_payments (gateway, gateway_transaction_id);

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_billing_cycle(v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
        WHEN v IS NULL THEN NULL
        WHEN lower(v) IN ('annual', 'annually', 'yearly', 'year') THEN 'yearly'
        WHEN lower(v) IN ('monthly', 'month') THEN 'monthly'
        ELSE lower(v)
    END $$;

CREATE OR REPLACE FUNCTION upsert_billing_plan(r billing_plans) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO billing_plans SELECT (r).*
    ON CONFLICT (id) DO UPDATE SET
        name          = EXCLUDED.name,
        display_name  = EXCLUDED.display_name,
        description   = EXCLUDED.description,
        monthly_price = EXCLUDED.monthly_price,
        yearly_price  = EXCLUDED.yearly_price,
        limits        = EXCLUDED.limits,
        features      = EXCLUDED.features,
        is_active     = EXCLUDED.is_active,
        updated_at    = EXCLUDED.updated_at
    WHERE billing_plans.channel = EXCLUDED.channel;
END $$;

CREATE OR REPLACE FUNCTION upsert_billing_subscription(r billing_subscriptions) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    r.plan_id := (SELECT id FROM billing_plans WHERE id = r.plan_id);
    INSERT INTO billing_subscriptions SELECT (r).*
    ON CONFLICT (id) DO UPDATE SET
        user_id                 = EXCLUDED.user_id,
        plan_id                 = EXCLUDED.plan_id,
        status                  = EXCLUDED.status,
        billing_cycle           = EXCLUDED.billing_cycle,
        current_period_start    = EXCLUDED.current_period_start,
        current_period_end      = EXCLUDED.current_period_end,
        cancel_at_period_end    = EXCLUDED.cancel_at_period_end,
        gateway                 = EXCLUDED.gateway,
        gateway_subscription_id = EXCLUDED.gateway_subscription_id,
        plan_snapshot           = EXCLUDED.plan_snapshot,
        updated_at              = EXCLUDED.updated_at
    WHERE billing_subscriptions.channel = EXCLUDED.channel;
END $$;

CREATE OR REPLACE FUNCTION upsert_billing_payment(r billing_payments) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    r.plan_id := (SELECT id FROM billing_plans WHERE id = r.plan_id);
    r.subscription_id := (SELECT id FROM billing_subscriptions WHERE id = r.subscription_id);
    INSERT INTO billing_payments SELECT (r).*
    ON CONFLICT (id) DO UPDATE SET
        user_id                = EXCLUDED.user_id,
        type                   = EXCLUDED.type,
        plan_id                = EXCLUDED.plan_id,
        subscription_id        = EXCLUDED.subscription_id,
        credit_package_id      = EXCLUDED.credit_package_id,
        gateway                = EXCLUDED.gateway,
        gateway_transaction_id = EXCLUDED.gateway_transaction_id,
        amount                 = EXCLUDED.amount,
        currency               = EXCLUDED.currency,
        billing_cycle          = EXCLUDED.billing_cycle,
        status                 = EXCLUDED.status,
        description            = EXCLUDED.description,
        credits_awarded        = EXCLUDED.credits_awarded,
        metadata               = EXCLUDED.metadata,
        paid_at                = EXCLUDED.paid_at,
        refunded_at            = EXCLUDED.refunded_at,
        updated_at             = EXCLUDED.updated_at
    WHERE billing_payments.channel = EXCLUDED.channel;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Per-table mappers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing_plan_from_calling(p plans) RETURNS billing_plans
LANGUAGE plpgsql AS $$
DECLARE
    r billing_plans;
BEGIN
    r.id            := p.id;
    r.channel       := 'calling';
    r.name          := p.name;
    r.display_name  := p.display_name;
    r.description   := p.description;
    r.monthly_price := p.monthly_price;
    r.yearly_price  := p.yearly_price;
    r.limits        := jsonb_build_object(
        'maxAgents', p.max_agents,
        'maxCampaigns', p.max_campaigns,
        'maxContactsPerCampaign', p.max_contacts_per_campaign,
        'maxWebhooks', p.max_webhooks,
        'maxKnowledgeBases', p.max_knowledge_bases,
        'maxFlows', p.max_flows,
        'maxPhoneNumbers', p.max_phone_numbers,
        'maxWidgets', p.max_widgets,
        'includedCredits', p.included_credits,
        'canChooseLlm', p.can_choose_llm,
        'canPurchaseNumbers', p.can_purchase_numbers,
        'sipEnabled', p.sip_enabled,
        'maxConcurrentSipCalls', p.max_concurrent_sip_calls,
        'restApiEnabled', p.rest_api_enabled,
        'teamManagementEnabled', p.team_management_enabled,
        'maxTeamMembers', p.max_team_members,
        'maxCustomRoles', p.max_custom_roles);
    r.features      := p.features;
    r.is_active     := p.is_active;
    r.created_at    := as_utc_timestamptz(p.created_at);
    r.updated_at    := as_utc_timestamptz(p.updated_at);
    RETURN r;
END $$;

CREATE OR REPLACE FUNCTION billing_plan_from_whatsapp(p wa_plans) RETURNS billing_plans
LANGUAGE plpgsql AS $$
DECLARE
    r billing_plans;
BEGIN
    r.id            := p.id;
    r.channel       := 'whatsapp';
    r.name          := p.name;
    r.display_name  := p.name;
    r.description   := p.description;
    r.monthly_price := p.monthly_price;
    r.yearly_price  := p.annual_price;
    r.limits        := coalesce(p.permissions, '{}'::jsonb);
    r.features      := p.features;
    r.is_active     := true;
    r.created_at    := coalesce(p.created_at, now());
    r.updated_at    := coalesce(p.updated_at, now());
    RETURN r;
END $$;

CREATE OR REPLACE FUNCTION billing_subscription_from_calling(s user_subscriptions) RETURNS billing_subscriptions
LANGUAGE plpgsql AS $$
DECLARE
    r billing_subscriptions;
BEGIN
    r.id                      := s.id;
    r.user_id                 := s.user_id;
    r.channel                 := 'calling';
    r.plan_id                 := s.plan_id;
    r.status                  := s.status;
    r.billing_cycle           := normalize_billing_cycle(s.billing_period);
    r.current_period_start    := as_utc_timestamptz(s.current_period_start);
    r.current_period_end      := as_utc_timestamptz(s.current_period_end);
    r.cancel_at_period_end    := s.cancel_at_period_end;
    r.gateway                 := CASE
                                     WHEN s.stripe_subscription_id IS NOT NULL THEN 'stripe'
                                     WHEN s.razorpay_subscription_id IS NOT NULL THEN 'razorpay'
                                     WHEN s.paypal_subscription_id IS NOT NULL THEN 'paypal'
                                     WHEN s.paystack_subscription_code IS NOT NULL THEN 'paystack'
                                     WHEN s.mercadopago_subscription_id IS NOT NULL THEN 'mercadopago'
                                     WHEN s.yookassa_subscription_id IS NOT NULL THEN 'yookassa'
                                 END;
    r.gateway_subscription_id := coalesce(s.stripe_subscription_id, s.razorpay_subscription_id, s.paypal_subscription_id,
                                          s.paystack_subscription_code, s.mercadopago_subscription_id, s.yookassa_subscription_id);
    r.plan_snapshot           := NULL;
    r.created_at              := as_utc_timestamptz(s.created_at);
    r.updated_at              := as_utc_timestamptz(s.updated_at);
    RETURN r;
END $$;

CREATE OR REPLACE FUNCTION billing_subscription_from_whatsapp(s subscriptions) RETURNS billing_subscriptions
LANGUAGE plpgsql AS $$
DECLARE
    r billing_subscriptions;
BEGIN
    r.id                      := s.id;
    r.user_id                 := s.user_id;
    r.channel                 := 'whatsapp';
    r.plan_id                 := s.plan_id;
    r.status                  := s.status;
    r.billing_cycle           := normalize_billing_cycle(s.billing_cycle);
    r.current_period_start    := s.start_date;
    r.current_period_end      := s.end_date;
    r.cancel_at_period_end    := NOT coalesce(s.auto_renew, true);
    r.gateway                 := s.gateway_provider;
    r.gateway_subscription_id := s.gateway_subscription_id;
    r.plan_snapshot           := s.plan_data;
    r.created_at              := coalesce(s.created_at, now());
    r.updated_at              := coalesce(s.updated_at, now());
    RETURN r;
END $$;

CREATE OR REPLACE FUNCTION billing_payment_from_calling(t payment_transactions) RETURNS billing_payments
LANGUAGE plpgsql AS $$
DECLARE
    r billing_payments;
BEGIN
    r.id                     := t.id;
    r.user_id                := t.user_id;
    r.channel                := 'calling';
    r.type                   := t.type;
    r.plan_id                := t.plan_id;
    r.subscription_id        := t.subscription_id;
    r.credit_package_id      := t.credit_package_id;
    r.gateway                := t.gateway;
    r.gateway_transaction_id := t.gateway_transaction_id;
    r.amount                 := t.amount;
    r.currency               := t.currency;
    r.billing_cycle          := normalize_billing_cycle(t.billing_period);
    r.status                 := t.status;
    r.description            := t.description;
    r.credits_awarded        := t.credits_awarded;
    r.metadata               := t.metadata;
    r.paid_at                := as_utc_timestamptz(t.completed_at);
    r.refunded_at            := NULL;
    r.created_at             := as_utc_timestamptz(t.created_at);
    r.updated_at             := as_utc_timestamptz(t.updated_at);
    RETURN r;
END $$;

CREATE OR REPLACE FUNCTION billing_payment_from_whatsapp(t transactions) RETURNS billing_payments
LANGUAGE plpgsql AS $$
DECLARE
    r billing_payments;
BEGIN
    r.id                     := t.id;
    r.user_id                := t.user_id;
    r.channel                := 'whatsapp';
    r.type                   := 'subscription';
    r.plan_id                := t.plan_id;
    r.subscription_id        := t.subscription_id;
    r.credit_package_id      := NULL;
    r.gateway                := coalesce((SELECT provider_key FROM payment_providers WHERE id = t.payment_provider_id),
                                         t.payment_provider_id);
    r.gateway_transaction_id := coalesce(t.provider_payment_id, t.provider_transaction_id, t.provider_payment_intent_id,
                                         t.provider_order_id);
    r.amount                 := t.amount;
    r.currency               := t.currency;
    r.billing_cycle          := normalize_billing_cycle(t.billing_cycle);
    r.status                 := t.status;
    r.description            := NULL;
    r.credits_awarded        := NULL;
    r.metadata               := t.metadata;
    r.paid_at                := t.paid_at;
    r.refunded_at            := t.refunded_at;
    r.created_at             := coalesce(t.created_at, now());
    r.updated_at             := coalesce(t.updated_at, now());
    RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Trigger function (one for all six tables)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION billing_sync() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_channel text := TG_ARGV[0];
    v_kind    text := TG_ARGV[1];
BEGIN
    BEGIN
        IF TG_OP = 'DELETE' THEN
            IF v_kind = 'plan' THEN
                DELETE FROM billing_plans WHERE id = OLD.id AND channel = v_channel;
            ELSIF v_kind = 'subscription' THEN
                DELETE FROM billing_subscriptions WHERE id = OLD.id AND channel = v_channel;
            ELSE
                DELETE FROM billing_payments WHERE id = OLD.id AND channel = v_channel;
            END IF;
            RETURN OLD;
        END IF;
        CASE TG_TABLE_NAME
            WHEN 'plans'                THEN PERFORM upsert_billing_plan(billing_plan_from_calling(NEW::plans));
            WHEN 'wa_plans'             THEN PERFORM upsert_billing_plan(billing_plan_from_whatsapp(NEW::wa_plans));
            WHEN 'user_subscriptions'   THEN PERFORM upsert_billing_subscription(billing_subscription_from_calling(NEW::user_subscriptions));
            WHEN 'subscriptions'        THEN PERFORM upsert_billing_subscription(billing_subscription_from_whatsapp(NEW::subscriptions));
            WHEN 'payment_transactions' THEN PERFORM upsert_billing_payment(billing_payment_from_calling(NEW::payment_transactions));
            WHEN 'transactions'         THEN PERFORM upsert_billing_payment(billing_payment_from_whatsapp(NEW::transactions));
        END CASE;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'billing sync skipped for % %: %', TG_TABLE_NAME, coalesce(NEW.id, OLD.id), SQLERRM;
    END;
    RETURN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Backfill (plans first so subscriptions and payments can link to them)
-- ---------------------------------------------------------------------------
SELECT upsert_billing_plan(billing_plan_from_calling(p)) FROM plans p;
SELECT upsert_billing_plan(billing_plan_from_whatsapp(p)) FROM wa_plans p;
SELECT upsert_billing_subscription(billing_subscription_from_calling(s)) FROM user_subscriptions s;
SELECT upsert_billing_subscription(billing_subscription_from_whatsapp(s)) FROM subscriptions s;
SELECT upsert_billing_payment(billing_payment_from_calling(t)) FROM payment_transactions t;
SELECT upsert_billing_payment(billing_payment_from_whatsapp(t)) FROM transactions t;

-- ---------------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    spec text[];
BEGIN
    FOREACH spec SLICE 1 IN ARRAY ARRAY[
        ARRAY['plans',                'calling',  'plan'],
        ARRAY['wa_plans',             'whatsapp', 'plan'],
        ARRAY['user_subscriptions',   'calling',  'subscription'],
        ARRAY['subscriptions',        'whatsapp', 'subscription'],
        ARRAY['payment_transactions', 'calling',  'payment'],
        ARRAY['transactions',         'whatsapp', 'payment']
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', spec[1] || '_billing_sync', spec[1]);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION billing_sync(%L, %L)',
            spec[1] || '_billing_sync', spec[1], spec[2], spec[3]);
    END LOOP;
END $$;
