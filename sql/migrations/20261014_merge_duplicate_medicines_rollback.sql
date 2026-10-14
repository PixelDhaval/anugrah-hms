-- Rollback for 20261014_merge_duplicate_medicines.sql
-- Removes the unique index and puts the deleted duplicate rows back with their
-- original ids, then drops the log.
-- Rows in other tables (e.g. ipd_prescriptions) that were repointed to the kept
-- row STAY on the kept row: the migration does not record which rows pointed
-- where. The medicine list is as before; for a full undo restore the backup.

BEGIN;

DROP INDEX IF EXISTS medicine_name_uq;

INSERT INTO medicine
SELECT (JSONB_POPULATE_RECORD(NULL::medicine, old_row)).*
FROM medicine_merge_log
ORDER BY old_id;

DROP TABLE medicine_merge_log;

COMMIT;
