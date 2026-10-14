const pool = require('../config/db');
const { withTransaction } = pool;

const TIMINGS = ['After', 'Before', 'With', 'If Required'];
const DOSES = ['morning', 'afternoon', 'evening'];

// The doctor row of the logged-in user (null when the user is not a doctor)
async function currentDoctorId(req) {
    const result = await pool.query(
        'SELECT doctor_id FROM doctors WHERE user_id = $1 AND delete = false',
        [req.session.user_id]
    );
    return result.rows.length ? result.rows[0].doctor_id : null;
}

// Validates and normalises the body; returns { error } or { name, medicines }
function parseTemplate(body) {
    const name = String(body.name || '').trim();
    if (!name) return { error: 'Template name is required' };
    if (name.length > 100) return { error: 'Template name is too long (max 100 characters)' };

    if (!Array.isArray(body.medicines) || body.medicines.length === 0) {
        return { error: 'Add at least one medicine' };
    }

    const medicines = [];
    for (const [i, m] of body.medicines.entries()) {
        const row = i + 1;
        const medName = String(m.name || '').trim();
        const nos = Number(m.nos);
        if (!medName) return { error: `Medicine ${row}: name is required` };
        if (!Number.isInteger(nos) || nos <= 0) return { error: `Medicine ${row}: Nos must be a whole number above 0` };

        if (m.is_custom) {
            const customDoses = String(m.custom_doses || '').trim();
            if (!customDoses) return { error: `Medicine ${row}: custom dose instructions are required` };
            medicines.push({ name: medName, nos, is_custom: true, dose_qty: '', doses: '', timing: '', custom_doses: customDoses });
        } else {
            const doseQty = String(m.dose_qty || '').trim();
            const doses = DOSES.filter(d => (Array.isArray(m.doses) ? m.doses : []).includes(d));
            if (!(Number(doseQty) > 0)) return { error: `Medicine ${row}: dose quantity must be above 0` };
            if (doses.length === 0) return { error: `Medicine ${row}: pick at least one of morning / afternoon / evening` };
            if (!TIMINGS.includes(m.timing)) return { error: `Medicine ${row}: pick a timing` };
            medicines.push({ name: medName, nos, is_custom: false, dose_qty: doseQty, doses: doses.join(', '), timing: m.timing, custom_doses: '' });
        }
    }
    return { name, medicines };
}

async function insertMedicines(client, templateId, medicines) {
    for (const [i, m] of medicines.entries()) {
        await client.query(
            `INSERT INTO prescription_template_medicines
                (template_id, sort_order, name, nos, is_custom, dose_qty, doses, timing, custom_doses)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [templateId, i, m.name, m.nos, m.is_custom, m.dose_qty, m.doses, m.timing, m.custom_doses]
        );
    }
}

exports.page = (req, res) => {
    res.render('prescription-templates');
};

// All live templates with their medicines. `mine=1` limits to the logged-in doctor.
exports.list = async (req, res) => {
    try {
        const doctorId = await currentDoctorId(req);
        const mineOnly = req.query.mine === '1';
        const result = await pool.query(
            `SELECT t.template_id, t.name, t.doctor_id, d.name AS doctor_name,
                    COALESCE(json_agg(json_build_object(
                        'name', m.name, 'nos', m.nos, 'is_custom', m.is_custom,
                        'dose_qty', m.dose_qty, 'doses', m.doses, 'timing', m.timing,
                        'custom_doses', m.custom_doses) ORDER BY m.sort_order)
                        FILTER (WHERE m.id IS NOT NULL), '[]') AS medicines
             FROM prescription_templates t
             JOIN doctors d ON d.doctor_id = t.doctor_id
             LEFT JOIN prescription_template_medicines m ON m.template_id = t.template_id
             WHERE NOT t.deleted AND ($1::boolean = false OR t.doctor_id = $2)
             GROUP BY t.template_id, d.name
             ORDER BY (t.doctor_id = $2) DESC, LOWER(t.name)`,
            [mineOnly, doctorId]
        );
        res.json({ doctorId, data: result.rows.map(r => ({ ...r, editable: r.doctor_id === doctorId })) });
    } catch (err) {
        console.error('Error fetching prescription templates:', err);
        res.status(500).json({ error: 'Error fetching templates' });
    }
};

// Medicine master (name + default dosing), for suggestions and auto-fill
exports.medicineNames = async (req, res) => {
    try {
        const result = await pool.query('SELECT name, qty, dose_qty, doses, timing FROM medicine ORDER BY LOWER(name)');
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error fetching medicine names:', err);
        res.status(500).json({ error: 'Error fetching medicines' });
    }
};

exports.create = async (req, res) => {
    const parsed = parseTemplate(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    try {
        const doctorId = await currentDoctorId(req);
        if (!doctorId) return res.status(403).json({ error: 'Only doctors can create templates' });

        const templateId = await withTransaction(async (client) => {
            const result = await client.query(
                'INSERT INTO prescription_templates (doctor_id, name) VALUES ($1, $2) RETURNING template_id',
                [doctorId, parsed.name]
            );
            await insertMedicines(client, result.rows[0].template_id, parsed.medicines);
            return result.rows[0].template_id;
        });
        res.json({ success: true, templateId });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'You already have a template with this name' });
        console.error('Error creating prescription template:', err);
        res.status(500).json({ error: 'Error creating template' });
    }
};

exports.update = async (req, res) => {
    const parsed = parseTemplate(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    try {
        const doctorId = await currentDoctorId(req);
        const found = await withTransaction(async (client) => {
            const result = await client.query(
                `UPDATE prescription_templates SET name = $1, updated_at = NOW()
                 WHERE template_id = $2 AND doctor_id = $3 AND NOT deleted RETURNING template_id`,
                [parsed.name, req.params.id, doctorId]
            );
            if (result.rows.length === 0) return false;
            await client.query('DELETE FROM prescription_template_medicines WHERE template_id = $1', [req.params.id]);
            await insertMedicines(client, req.params.id, parsed.medicines);
            return true;
        });
        if (!found) return res.status(404).json({ error: 'Template not found' });
        res.json({ success: true });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'You already have a template with this name' });
        console.error('Error updating prescription template:', err);
        res.status(500).json({ error: 'Error updating template' });
    }
};

exports.remove = async (req, res) => {
    try {
        const doctorId = await currentDoctorId(req);
        const result = await pool.query(
            `UPDATE prescription_templates SET deleted = true, updated_at = NOW()
             WHERE template_id = $1 AND doctor_id = $2 AND NOT deleted RETURNING template_id`,
            [req.params.id, doctorId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting prescription template:', err);
        res.status(500).json({ error: 'Error deleting template' });
    }
};
