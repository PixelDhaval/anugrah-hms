# Database migrations

Each migration is a plain SQL file that runs inside one transaction: it either
applies completely or, on any error, changes nothing. Every migration has a
matching `_rollback.sql`.

| File | What it does |
|------|--------------|
| `20261012_add_bill_numbers.sql` | Financial-year bill numbers (`25-26/OPD/00001`, `25-26/IPD/00001`) |
| `20261014_add_prescription_templates.sql` | Prescription templates (fixed medicines + dosages) doctors can import into an OPD prescription |
| `20261014_merge_duplicate_medicines.sql` | Merges duplicate medicines in the medicine master and blocks new ones |

---

## 20261012_add_bill_numbers — financial-year bill numbers

**What changes in the database**

- New table `bill_number_counters` (last number used per financial year and type)
- New column `bill_no` on `bills` (OPD) and on `ipd_appointments` (IPD), unique, required
- Functions `financial_year`, `format_bill_no`, `next_bill_no`
- Triggers that give every new bill / admission its number automatically
- Every existing bill and admission is numbered in date order within its
  financial year (April–March); new numbers continue from there

Takes well under a second on the current data. It briefly locks `bills` and
`ipd_appointments` while it runs, so pick a quiet moment (no one saving a bill).

**Order matters:** run the migration first, then update the app. The old app
keeps working after the migration (numbers are added by the database), but the
new app needs the `bill_no` columns to exist.

### Steps on the server PC (Windows, PostgreSQL 16)

Open **Command Prompt** on the server. If PostgreSQL is installed somewhere
else, or is a different version, change `C:\Program Files\PostgreSQL\16` below.

1. **Go to the PostgreSQL tools folder**

   ```bat
   cd "C:\Program Files\PostgreSQL\16\bin"
   ```

2. **Back up the database** (asks for the `postgres` password)

   ```bat
   mkdir C:\anugrah-backups
   pg_dump -h localhost -U postgres -d postgres -F c -f C:\anugrah-backups\before_bill_numbers.dump
   ```

   Check that `C:\anugrah-backups\before_bill_numbers.dump` exists and is not
   0 KB before continuing.

3. **Run the migration.** Use the path where the app's code is on the server:

   ```bat
   psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f "C:\path\to\anugrah-hms\sql\migrations\20261012_add_bill_numbers.sql"
   ```

   The output must end with `COMMIT`. If you see `ERROR` instead, nothing was
   changed: stop and send the full output.

4. **Check the result**

   ```bat
   psql -h localhost -U postgres -d postgres -c "SELECT * FROM bill_number_counters ORDER BY 1, 2;"
   psql -h localhost -U postgres -d postgres -c "SELECT COUNT(*) AS bills, COUNT(DISTINCT bill_no) AS numbered FROM bills;"
   ```

   - The counters list one row per financial year and type (24-25, 25-26, 26-27 …).
   - `bills` and `numbered` are the same number.

5. **Update and restart the app**: pull/copy the new code onto the server, run
   `npm install`, then restart the app the way you normally do.

6. **Try it**: create one OPD bill as usual. A message shows its number
   (for example `Bill 26-27/OPD/01471 generated.`), and the number appears in
   the OPD Billing list and on the printed bill and receipt.

Prefer pgAdmin? For step 3, open **Query Tool** on the `postgres` database,
open the `.sql` file, and press **Execute (F5)**. The messages panel must end
with `COMMIT`. Take the backup in step 2 first either way.

### Undoing it

1. Put back the previous version of the app and restart it.
2. Run the rollback script (bill numbers are removed):

   ```bat
   psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f "C:\path\to\anugrah-hms\sql\migrations\20261012_add_bill_numbers_rollback.sql"
   ```

   Restoring the whole backup from step 2 is the other option, **but it also
   throws away every bill, payment and patient change made after the backup**,
   so only use it straight after a failed attempt:

   ```bat
   pg_restore -h localhost -U postgres -d postgres --clean --if-exists C:\anugrah-backups\before_bill_numbers.dump
   ```

### Good to know

- **Financial year** = 1 April to 31 March, taken from the bill date (OPD) or
  admission date (IPD). `25-26` = 1 Apr 2025 – 31 Mar 2026. Numbering restarts
  at `00001` on 1 April automatically.
- **Deleted bills leave a gap** in the sequence; numbers are never reused.
- **Changing a bill's date** later does not change its number.
- **Past 99999** bills in a year the number simply grows to six digits.
- Never type a `bill_no` by hand; the database assigns it.


---

## 20261014_add_prescription_templates — prescription templates

**What changes in the database**

- New table `prescription_templates` (name + owning doctor, soft-deleted)
- New table `prescription_template_medicines` (the medicines of a template, in order)
- Nothing existing is altered: no existing table, column or row is touched, and
  the old app keeps working if the migration is run first.

Instant, and no locks on existing tables. Needs `doctors.doctor_id` to be an
`INTEGER` primary key (the migration stops with an error, changing nothing, if not).

**Order matters:** run the migration first, then update the app. The new app
needs the two tables to exist.

### Steps on the server PC

Same as the steps in the bill-numbers section above (backup, then run the file):

```bat
cd "C:\Program Files\PostgreSQL\16\bin"
psql -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -f "C:\path\to\anugrah-hms\sql\migrations\20261014_add_prescription_templates.sql"
```

The output must end with `COMMIT`. Check: `psql -h localhost -U postgres -d postgres -c "\d prescription_templates"`.

### Undoing it

Deploy the previous app version, then run
`20261014_add_prescription_templates_rollback.sql` the same way. Saved templates
are deleted; prescriptions already made from a template are not affected
(they keep their own copy of the medicines).

### Using it

- **Doctors > Prescription Templates**: a doctor creates, edits and deletes their own
  templates. Other users can see all templates but not change them.
- **OPD prescription page > Import Template**: pick a template; its medicines are
  added below any medicines already on the form and can still be edited.


---

## 20261014_merge_duplicate_medicines — merge duplicate medicines

**Check first (read-only)** — see what would be merged:

```sql
SELECT LOWER(REGEXP_REPLACE(TRIM(name), '\s+', ' ', 'g')) AS medicine,
       COUNT(*) AS copies, ARRAY_AGG(id ORDER BY id) AS ids,
       COUNT(DISTINCT (qty, dose_qty, doses, timing)) AS different_dosings
FROM medicine GROUP BY 1 HAVING COUNT(*) > 1 ORDER BY 1;
```

Rows with `different_dosings` above 1 have copies with different default
dosing. The **oldest** copy (lowest id) wins and its dosing is kept; fix the
dosing on that row afterwards from the same list if another copy was the right one.

**What changes**

- Duplicates (same name ignoring case and extra spaces) are reduced to one row.
- Every table that references `medicine.id` (e.g. `ipd_prescriptions`) is
  pointed at the kept row first, so no IPD prescription loses its medicine.
- OPD prescriptions and templates store the medicine *name* as text: unaffected.
- The deleted rows are saved in the new table `medicine_merge_log`.
- A unique index prevents new duplicates. Adding a "new" medicine that differs
  only by case/spacing is then quietly skipped by the app instead of duplicated.

**Steps:** back up first (`pg_dump`, as in the bill-numbers section), run the
file with `psql ... -v ON_ERROR_STOP=1 -f`, and confirm the output ends with `COMMIT`.
If it fails (for example a unique rule on another table that the merge would
break), nothing is changed.

**Undo:** the rollback script restores the deleted medicine rows and removes the
index, but IPD prescriptions already moved to the kept row stay there. For a
complete undo restore the backup.
