-- Rollback for 20261012_add_bill_numbers.sql
-- Removes the bill_no columns, triggers, functions and counters.
-- The bill numbers themselves are lost, so only run this if the
-- migration has to be undone (and deploy the previous app version first).

BEGIN;

DROP TRIGGER IF EXISTS bills_assign_bill_no ON bills;
DROP TRIGGER IF EXISTS ipd_appointments_assign_bill_no ON ipd_appointments;

DROP FUNCTION IF EXISTS assign_opd_bill_no();
DROP FUNCTION IF EXISTS assign_ipd_bill_no();

ALTER TABLE bills            DROP COLUMN IF EXISTS bill_no;
ALTER TABLE ipd_appointments DROP COLUMN IF EXISTS bill_no;

DROP FUNCTION IF EXISTS next_bill_no(VARCHAR, DATE);
DROP FUNCTION IF EXISTS format_bill_no(VARCHAR, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS financial_year(DATE);

DROP TABLE IF EXISTS bill_number_counters;

COMMIT;
