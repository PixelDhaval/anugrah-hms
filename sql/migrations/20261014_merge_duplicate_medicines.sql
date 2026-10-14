-- Migration: merge duplicate rows in the medicine master
--   Duplicates = same name ignoring upper/lower case and extra spaces
--   ("Paracetamol 500", "paracetamol 500 " ...).
--   For each group the OLDEST row (lowest id) is kept, with its own dosing.
--   Before a duplicate is deleted, every table that references it by id
--   (found automatically from the foreign keys, e.g. ipd_prescriptions.medicine_id)
--   is pointed at the kept row, so no other table loses data.
--   OPD prescriptions and prescription templates store the medicine NAME as text
--   and are not affected.
--   Finally a unique index stops new duplicates.
--
-- The deleted rows are kept in medicine_merge_log (full copy) so nothing is lost.
-- Rollback: 20261014_merge_duplicate_medicines_rollback.sql
--           (puts the deleted rows back; see the README for the limits)
--
-- Runs in a single transaction: if any step fails, nothing is changed.

BEGIN;

-- 1. Work out which row survives -------------------------------------------

CREATE TEMP TABLE medicine_merge_map ON COMMIT DROP AS
SELECT id AS old_id, kept_id
FROM (
    SELECT id, MIN(id) OVER (PARTITION BY LOWER(REGEXP_REPLACE(TRIM(name), '\s+', ' ', 'g'))) AS kept_id
    FROM medicine
) g
WHERE id <> kept_id;

-- 2. Keep a copy of everything that is about to be deleted ------------------

CREATE TABLE medicine_merge_log (
    old_id    INTEGER   PRIMARY KEY,
    kept_id   INTEGER   NOT NULL,
    old_row   JSONB     NOT NULL,
    merged_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO medicine_merge_log (old_id, kept_id, old_row)
SELECT med.id, map.kept_id, TO_JSONB(med)
FROM medicine_merge_map map
JOIN medicine med ON med.id = map.old_id;

-- 3. Point every table that references medicine(id) at the kept row ---------

DO $$
DECLARE
    fk RECORD;
BEGIN
    FOR fk IN
        SELECT c.conrelid::regclass AS ref_table, a.attname AS ref_column
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f'
          AND c.confrelid = 'medicine'::regclass
          AND ARRAY_LENGTH(c.conkey, 1) = 1
    LOOP
        EXECUTE FORMAT(
            'UPDATE %s t SET %I = map.kept_id FROM medicine_merge_map map WHERE t.%I = map.old_id',
            fk.ref_table, fk.ref_column, fk.ref_column);
        RAISE NOTICE 'Repointed %.%', fk.ref_table, fk.ref_column;
    END LOOP;

    -- A foreign key spanning several columns cannot be repointed safely: stop.
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE contype = 'f' AND confrelid = 'medicine'::regclass
                 AND ARRAY_LENGTH(conkey, 1) > 1) THEN
        RAISE EXCEPTION 'A multi-column foreign key references medicine; merge by hand';
    END IF;
END $$;

-- 4. Remove the duplicates (fails, changing nothing, if something still references them)

DELETE FROM medicine WHERE id IN (SELECT old_id FROM medicine_merge_map);

-- 5. No new duplicates --------------------------------------------------------

CREATE UNIQUE INDEX medicine_name_uq
    ON medicine (LOWER(REGEXP_REPLACE(TRIM(name), '\s+', ' ', 'g')));

COMMIT;
