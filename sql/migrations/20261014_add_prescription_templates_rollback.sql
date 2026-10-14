-- Rollback for 20261014_add_prescription_templates.sql
-- Drops both template tables. Saved templates are lost; prescriptions that
-- already used a template are NOT affected (they keep their own copy).
-- Deploy the previous app version first.

BEGIN;

DROP TABLE IF EXISTS prescription_template_medicines;
DROP TABLE IF EXISTS prescription_templates;

COMMIT;
