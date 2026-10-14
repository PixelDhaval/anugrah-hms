-- Migration: prescription templates
--   A doctor saves a named set of medicines with fixed dosages
--   (e.g. "Fever - adult") and imports it into an OPD prescription in one click.
--   - prescription_templates          one row per template, owned by a doctor
--   - prescription_template_medicines the medicines of a template, in order
--   Medicine columns mirror what the OPD prescription form saves
--   (name, nos, dose_qty, doses, timing, is_custom, custom_doses).
--   Only NEW tables are created: no existing table or row is touched.
--
-- Rollback: 20261014_add_prescription_templates_rollback.sql
--
-- Runs in a single transaction: if any step fails, nothing is changed.

BEGIN;

CREATE TABLE prescription_templates (
    template_id SERIAL       PRIMARY KEY,
    doctor_id   INTEGER      NOT NULL REFERENCES doctors(doctor_id),
    name        VARCHAR(100) NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE,   -- soft delete, like users/doctors
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- A doctor cannot have two live templates with the same name
CREATE UNIQUE INDEX prescription_templates_doctor_name_uq
    ON prescription_templates (doctor_id, LOWER(TRIM(name)))
    WHERE NOT deleted;

CREATE TABLE prescription_template_medicines (
    id           SERIAL       PRIMARY KEY,
    template_id  INTEGER      NOT NULL REFERENCES prescription_templates(template_id) ON DELETE CASCADE,
    sort_order   INTEGER      NOT NULL,
    name         VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    nos          INTEGER      NOT NULL CHECK (nos > 0),
    is_custom    BOOLEAN      NOT NULL DEFAULT FALSE,
    -- standard dosing (is_custom = false)
    dose_qty     VARCHAR(20)  NOT NULL DEFAULT '',      -- e.g. '1', '0.5'
    doses        VARCHAR(50)  NOT NULL DEFAULT '',      -- e.g. 'morning, evening'
    timing       VARCHAR(20)  NOT NULL DEFAULT '',      -- After / Before / With / If Required
    -- free-text dosing (is_custom = true)
    custom_doses TEXT         NOT NULL DEFAULT '',
    CONSTRAINT template_medicine_dosing_chk CHECK (
        (is_custom AND LENGTH(TRIM(custom_doses)) > 0)
        OR (NOT is_custom AND dose_qty <> '' AND doses <> '' AND timing <> '')
    )
);

CREATE INDEX prescription_template_medicines_template_idx
    ON prescription_template_medicines (template_id, sort_order);

COMMIT;
