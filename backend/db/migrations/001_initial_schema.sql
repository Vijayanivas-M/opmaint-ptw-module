-- =============================================================================
-- PTW CMMS Module - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
    'requester',
    'area_owner',
    'safety_officer',
    'admin'
);

CREATE TYPE permit_status AS ENUM (
    'draft',           -- Saved but not yet submitted
    'pending_area',    -- Awaiting Area Owner approval
    'pending_safety',  -- Awaiting Safety Officer approval
    'approved',        -- Fully approved, work may begin
    'active',          -- Work is currently in progress
    'completed',       -- Work finished, permit closed normally
    'rejected',        -- Rejected at any approval stage
    'cancelled',       -- Cancelled by requester or admin
    'expired'          -- Past end_time without completion
);

CREATE TYPE permit_type AS ENUM (
    'hot_work',
    'confined_space',
    'working_at_height',
    'electrical'
);

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id     VARCHAR(50)     NOT NULL UNIQUE,
    full_name       VARCHAR(150)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   TEXT            NOT NULL,
    role            user_role       NOT NULL DEFAULT 'requester',
    department      VARCHAR(100),
    phone           VARCHAR(30),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role       ON users (role);
CREATE INDEX idx_users_email      ON users (email);
CREATE INDEX idx_users_is_active  ON users (is_active);

-- ---------------------------------------------------------------------------
-- BASE PERMITS TABLE
-- Holds all fields common across every permit type.
-- Type-specific data lives in the four child extension tables below.
-- ---------------------------------------------------------------------------
CREATE TABLE permits (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    permit_number       VARCHAR(30)     NOT NULL UNIQUE,
    permit_type         permit_type     NOT NULL,
    status              permit_status   NOT NULL DEFAULT 'draft',

    -- People
    requester_id        UUID            NOT NULL REFERENCES users (id),
    area_owner_id       UUID            REFERENCES users (id),
    safety_officer_id   UUID            REFERENCES users (id),

    -- Work details
    work_description    TEXT            NOT NULL,
    location            VARCHAR(255)    NOT NULL,
    equipment_tag       VARCHAR(100),

    -- Schedule
    planned_start       TIMESTAMPTZ     NOT NULL,
    planned_end         TIMESTAMPTZ     NOT NULL,
    actual_start        TIMESTAMPTZ,
    actual_end          TIMESTAMPTZ,

    -- Approval chain timestamps
    submitted_at        TIMESTAMPTZ,
    area_approved_at    TIMESTAMPTZ,
    safety_approved_at  TIMESTAMPTZ,

    -- Rejection / cancellation
    rejected_by         UUID            REFERENCES users (id),
    rejected_at         TIMESTAMPTZ,
    rejection_reason    TEXT,

    -- Metadata
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_dates CHECK (planned_end > planned_start)
);

CREATE INDEX idx_permits_status         ON permits (status);
CREATE INDEX idx_permits_permit_type    ON permits (permit_type);
CREATE INDEX idx_permits_requester      ON permits (requester_id);
CREATE INDEX idx_permits_area_owner     ON permits (area_owner_id);
CREATE INDEX idx_permits_safety_officer ON permits (safety_officer_id);
CREATE INDEX idx_permits_planned_start  ON permits (planned_start);

-- ---------------------------------------------------------------------------
-- PERMIT EXTENSION TABLES  (one-to-one with permits, keyed on permit_id)
-- ---------------------------------------------------------------------------

-- 1. HOT WORK PERMITS
CREATE TABLE permit_hot_work (
    permit_id               UUID        PRIMARY KEY REFERENCES permits (id) ON DELETE CASCADE,
    hot_work_type           VARCHAR(80) NOT NULL,
    fire_watch_required     BOOLEAN     NOT NULL DEFAULT FALSE,
    fire_watch_name         VARCHAR(150),
    fire_extinguisher_type  VARCHAR(50),
    fire_blanket_used       BOOLEAN     NOT NULL DEFAULT FALSE,
    flammable_gas_cleared   BOOLEAN     NOT NULL DEFAULT FALSE,
    gas_test_reading_ppm    NUMERIC(8,2),
    gas_tested_by           UUID        REFERENCES users (id),
    gas_tested_at           TIMESTAMPTZ,
    additional_controls     JSONB       NOT NULL DEFAULT '[]'::JSONB
);

-- 2. CONFINED SPACE PERMITS
CREATE TABLE permit_confined_space (
    permit_id                   UUID         PRIMARY KEY REFERENCES permits (id) ON DELETE CASCADE,
    space_description           TEXT         NOT NULL,
    space_type                  VARCHAR(80),
    oxygen_pct                  NUMERIC(5,2),
    lel_pct                     NUMERIC(5,2),
    co_ppm                      NUMERIC(8,2),
    h2s_ppm                     NUMERIC(8,2),
    atmosphere_tested_by        UUID         REFERENCES users (id),
    atmosphere_tested_at        TIMESTAMPTZ,
    entrant_names               JSONB        NOT NULL DEFAULT '[]'::JSONB,
    standby_person_name         VARCHAR(150) NOT NULL,
    rescue_plan_confirmed       BOOLEAN      NOT NULL DEFAULT FALSE,
    lockout_tagout_applied      BOOLEAN      NOT NULL DEFAULT FALSE,
    isolation_certificate_ref   VARCHAR(100),
    mechanical_ventilation      BOOLEAN      NOT NULL DEFAULT FALSE,
    ventilation_details         TEXT,
    additional_controls         JSONB        NOT NULL DEFAULT '[]'::JSONB
);

-- 3. WORKING AT HEIGHT PERMITS
CREATE TABLE permit_working_at_height (
    permit_id                   UUID         PRIMARY KEY REFERENCES permits (id) ON DELETE CASCADE,
    working_height_meters       NUMERIC(6,2) NOT NULL,
    work_method                 VARCHAR(80)  NOT NULL,
    harness_inspection_done     BOOLEAN      NOT NULL DEFAULT FALSE,
    harness_inspector_name      VARCHAR(150),
    lanyard_type                VARCHAR(80),
    anchor_point_confirmed      BOOLEAN      NOT NULL DEFAULT FALSE,
    anchor_point_details        TEXT,
    scaffold_tag_number         VARCHAR(50),
    scaffold_inspected_by       UUID         REFERENCES users (id),
    scaffold_inspected_at       TIMESTAMPTZ,
    barricade_erected           BOOLEAN      NOT NULL DEFAULT FALSE,
    overhead_hazard_cleared     BOOLEAN      NOT NULL DEFAULT FALSE,
    weather_conditions_checked  BOOLEAN      NOT NULL DEFAULT FALSE,
    additional_controls         JSONB        NOT NULL DEFAULT '[]'::JSONB
);

-- 4. ELECTRICAL PERMITS
CREATE TABLE permit_electrical (
    permit_id                   UUID         PRIMARY KEY REFERENCES permits (id) ON DELETE CASCADE,
    voltage_level               VARCHAR(30)  NOT NULL,
    is_live_work                BOOLEAN      NOT NULL DEFAULT FALSE,
    panel_or_circuit_id         VARCHAR(100),
    loto_applied                BOOLEAN      NOT NULL DEFAULT FALSE,
    loto_certificate_ref        VARCHAR(100),
    isolated_by                 UUID         REFERENCES users (id),
    isolated_at                 TIMESTAMPTZ,
    isolation_verified_by       UUID         REFERENCES users (id),
    isolation_verified_at       TIMESTAMPTZ,
    ppe_required                JSONB        NOT NULL DEFAULT '[]'::JSONB,
    authorized_electrician_name VARCHAR(150),
    electrician_license_ref     VARCHAR(100),
    live_work_justification     TEXT,
    live_work_risk_level        VARCHAR(20),
    additional_controls         JSONB        NOT NULL DEFAULT '[]'::JSONB
);

-- ---------------------------------------------------------------------------
-- AUDIT LOGS
-- Immutable event trail. Never update or delete rows in this table.
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id              BIGSERIAL       PRIMARY KEY,
    entity_type     VARCHAR(50)     NOT NULL,
    entity_id       UUID            NOT NULL,
    action          VARCHAR(50)     NOT NULL,
    actor_id        UUID            REFERENCES users (id) ON DELETE SET NULL,
    actor_role      user_role,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor  ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_time   ON audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- TRIGGER: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_permits_updated_at
    BEFORE UPDATE ON permits
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- TRIGGER: auto-generate human-readable permit numbers
--   Format: PTW-YYYY-NNNNN  (e.g. PTW-2024-00001)
-- ---------------------------------------------------------------------------
CREATE SEQUENCE permit_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_permit_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.permit_number IS NULL OR NEW.permit_number = '' THEN
        NEW.permit_number := 'PTW-' ||
                             TO_CHAR(NOW(), 'YYYY') || '-' ||
                             LPAD(NEXTVAL('permit_number_seq')::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_permits_permit_number
    BEFORE INSERT ON permits
    FOR EACH ROW EXECUTE FUNCTION generate_permit_number();
