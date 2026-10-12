-- Migration: financial-year bill numbers
--   Format: <FY>/<TYPE>/<NNNNN>, e.g. 25-26/OPD/00001, 25-26/IPD/00001
--   - FY runs April to March (25-26 = 1 Apr 2025 to 31 Mar 2026)
--   - Numbers count up per FY and type, and restart at 00001 every April
--   - OPD bills (bills table) are numbered by bill date,
--     IPD admissions (ipd_appointments table) by admission date
--   - Existing rows are numbered in date order; new rows get a number
--     automatically on INSERT (trigger), so the app never computes it
--
-- Rollback: 20261012_add_bill_numbers_rollback.sql
--
-- Runs in a single transaction: if any step fails, nothing is changed.

BEGIN;

-- 1. Counter per financial year and bill type ------------------------------

CREATE TABLE bill_number_counters (
    financial_year VARCHAR(5) NOT NULL,                 -- '25-26'
    bill_type      VARCHAR(3) NOT NULL CHECK (bill_type IN ('OPD', 'IPD')),
    last_number    INTEGER    NOT NULL CHECK (last_number >= 0),
    PRIMARY KEY (financial_year, bill_type)
);

-- 2. Helper functions ------------------------------------------------------

-- '25-26' for any date between 1 Apr 2025 and 31 Mar 2026
CREATE FUNCTION financial_year(d DATE) RETURNS VARCHAR(5)
LANGUAGE sql IMMUTABLE AS $$
    SELECT LPAD((fy_start % 100)::TEXT, 2, '0') || '-' || LPAD(((fy_start + 1) % 100)::TEXT, 2, '0')
    FROM (SELECT EXTRACT(YEAR FROM d)::INT - CASE WHEN EXTRACT(MONTH FROM d) < 4 THEN 1 ELSE 0 END AS fy_start) fy
$$;

-- '25-26/OPD/00042'. Never truncates: past 99999 it simply grows to 6 digits.
CREATE FUNCTION format_bill_no(fy VARCHAR, bill_type VARCHAR, n INTEGER) RETURNS VARCHAR(20)
LANGUAGE sql IMMUTABLE AS $$
    SELECT fy || '/' || bill_type || '/' || LPAD(n::TEXT, GREATEST(5, LENGTH(n::TEXT)), '0')
$$;

-- Reserves the next number for a type in the FY of the given date.
-- The upsert locks that counter row until the surrounding transaction ends,
-- so two bills created at the same moment can never get the same number,
-- and a failed insert rolls the counter back (no gaps from errors).
-- (p_ prefixes keep the parameters from clashing with the table's column names)
CREATE FUNCTION next_bill_no(p_bill_type VARCHAR, p_bill_date DATE) RETURNS VARCHAR(20)
LANGUAGE plpgsql AS $$
DECLARE
    v_fy VARCHAR(5) := financial_year(p_bill_date);
    v_n  INTEGER;
BEGIN
    INSERT INTO bill_number_counters AS c (financial_year, bill_type, last_number)
    VALUES (v_fy, p_bill_type, 1)
    ON CONFLICT ON CONSTRAINT bill_number_counters_pkey
        DO UPDATE SET last_number = c.last_number + 1
    RETURNING c.last_number INTO v_n;

    RETURN format_bill_no(v_fy, p_bill_type, v_n);
END;
$$;

-- 3. New columns -----------------------------------------------------------

ALTER TABLE bills            ADD COLUMN bill_no VARCHAR(20);
ALTER TABLE ipd_appointments ADD COLUMN bill_no VARCHAR(20);

-- 4. Number existing rows (date order within each FY) ----------------------

WITH numbered AS (
    SELECT bill_id,
           financial_year(date) AS fy,
           ROW_NUMBER() OVER (PARTITION BY financial_year(date) ORDER BY date, bill_id) AS n
    FROM bills
)
UPDATE bills b
SET bill_no = format_bill_no(numbered.fy, 'OPD', numbered.n::INT)
FROM numbered
WHERE b.bill_id = numbered.bill_id;

WITH numbered AS (
    SELECT id,
           financial_year(appointment_date::DATE) AS fy,
           ROW_NUMBER() OVER (PARTITION BY financial_year(appointment_date::DATE) ORDER BY appointment_date, id) AS n
    FROM ipd_appointments
)
UPDATE ipd_appointments a
SET bill_no = format_bill_no(numbered.fy, 'IPD', numbered.n::INT)
FROM numbered
WHERE a.id = numbered.id;

-- Counters continue from the highest number used in each FY
INSERT INTO bill_number_counters (financial_year, bill_type, last_number)
SELECT financial_year(date), 'OPD', COUNT(*) FROM bills GROUP BY 1
UNION ALL
SELECT financial_year(appointment_date::DATE), 'IPD', COUNT(*) FROM ipd_appointments GROUP BY 1;

-- 5. Uniqueness (after the backfill, so it is checked against real data) ----

ALTER TABLE bills            ADD CONSTRAINT bills_bill_no_key            UNIQUE (bill_no);
ALTER TABLE ipd_appointments ADD CONSTRAINT ipd_appointments_bill_no_key UNIQUE (bill_no);

-- 6. Assign a number to every new row --------------------------------------

-- bills only holds OPD bills; IPD bills live on ipd_appointments
CREATE FUNCTION assign_opd_bill_no() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.bill_no IS NULL THEN
        NEW.bill_no := next_bill_no('OPD', COALESCE(NEW.date, CURRENT_DATE));
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION assign_ipd_bill_no() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.bill_no IS NULL THEN
        NEW.bill_no := next_bill_no('IPD', COALESCE(NEW.appointment_date::DATE, CURRENT_DATE));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER bills_assign_bill_no
    BEFORE INSERT ON bills
    FOR EACH ROW EXECUTE FUNCTION assign_opd_bill_no();

CREATE TRIGGER ipd_appointments_assign_bill_no
    BEFORE INSERT ON ipd_appointments
    FOR EACH ROW EXECUTE FUNCTION assign_ipd_bill_no();

-- 7. Every row must now have a number --------------------------------------

ALTER TABLE bills            ALTER COLUMN bill_no SET NOT NULL;
ALTER TABLE ipd_appointments ALTER COLUMN bill_no SET NOT NULL;

COMMIT;
