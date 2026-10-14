const pool = require('../config/db');
const { withTransaction } = pool;

exports.page = (req, res) => {
    res.render('merge-medicines');
};

// Every medicine with the number of IPD prescription lines using it
exports.list = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT m.id, m.name, m.qty, m.dose_qty, m.doses, m.timing,
                    COUNT(p.*)::int AS ipd_uses
             FROM medicine m
             LEFT JOIN ipd_prescriptions p ON p.medicine_id = m.id
             GROUP BY m.id
             ORDER BY LOWER(m.name), m.id`
        );
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error fetching medicines for merge:', err);
        res.status(500).json({ error: 'Error fetching medicines' });
    }
};

// Merges mergeIds into keepId: every table that references medicine(id) is
// repointed to keepId first, then the merged rows are deleted.
exports.merge = async (req, res) => {
    const keepId = Number(req.body.keepId);
    const mergeIds = [...new Set((req.body.mergeIds || []).map(Number))];

    if (!Number.isInteger(keepId) || mergeIds.length === 0 || mergeIds.some(id => !Number.isInteger(id))) {
        return res.status(400).json({ error: 'Choose a medicine to keep and at least one to merge into it' });
    }
    if (mergeIds.includes(keepId)) {
        return res.status(400).json({ error: 'The kept medicine cannot also be merged away' });
    }

    try {
        const merged = await withTransaction(async (client) => {
            const rows = await client.query(
                'SELECT id FROM medicine WHERE id = ANY($1::int[]) FOR UPDATE',
                [[keepId, ...mergeIds]]
            );
            if (rows.rows.length !== mergeIds.length + 1) {
                throw Object.assign(new Error('Some of these medicines no longer exist. Reload the page.'), { status: 409 });
            }

            const fks = await client.query(
                `SELECT c.conrelid::regclass::text AS ref_table, a.attname AS ref_column, ARRAY_LENGTH(c.conkey, 1) AS cols
                 FROM pg_constraint c
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
                 WHERE c.contype = 'f' AND c.confrelid = 'medicine'::regclass`
            );
            if (fks.rows.some(fk => fk.cols > 1)) {
                throw new Error('A multi-column foreign key references medicine; cannot merge safely');
            }

            // Keep a copy of what is deleted, when the merge migration's log table exists
            const hasLog = (await client.query("SELECT to_regclass('medicine_merge_log') AS t")).rows[0].t;
            if (hasLog) {
                await client.query(
                    `INSERT INTO medicine_merge_log (old_id, kept_id, old_row)
                     SELECT id, $1, TO_JSONB(m) FROM medicine m WHERE id = ANY($2::int[])`,
                    [keepId, mergeIds]
                );
            }

            // ref_table comes from pg_constraint (already schema-qualified/quoted), ref_column is quoted with %I-style escaping
            for (const fk of fks.rows) {
                const col = '"' + fk.ref_column.replace(/"/g, '""') + '"';
                await client.query(
                    `UPDATE ${fk.ref_table} SET ${col} = $1 WHERE ${col} = ANY($2::int[])`,
                    [keepId, mergeIds]
                );
            }

            const del = await client.query('DELETE FROM medicine WHERE id = ANY($1::int[])', [mergeIds]);
            return del.rowCount;
        });
        res.json({ success: true, merged });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Error merging medicines:', err);
        res.status(500).json({ error: 'Error merging medicines' });
    }
};
