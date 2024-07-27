const pool = require('../config/db');

exports.createPrescription = (req, res) => {
    res.render('create-prescription');
};

exports.manageAppointment = (req, res) => {
    res.render('manage-appointment');
};

exports.getPatientRecords = async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(`
            SELECT
                a.appointment_id,
                p.patient_id,
                p.name,
                p.age,
                p.address AS address,
                p.phone AS number,
                 TO_CHAR(p.last_visited, 'YYYY-MM-DD') AS last_visited,
                a.status
            FROM
                appointments a
            JOIN
                patients p ON a.patient_id = p.patient_id;
        `);
        client.release();

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointment data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updatePatientRecord = async (req, res) => {
    const {
        appointmentId,
        patientId,
        name,
        age,
        address,
        number,
        lastVisit,
        status
    } = req.body;

    // Update patient details
    const updatePatientQuery = `
        UPDATE patients
        SET name = $1, age = $2, address = $3, phone = $4, last_visited = $5
        WHERE patient_id = $6
    `;
    const patientValues = [name, age, address, number, lastVisit, patientId];

    // Update appointment status
    const updateAppointmentQuery = `
        UPDATE appointments
        SET status = $1
        WHERE appointment_id = $2
    `;
    const appointmentValues = [status, appointmentId];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query(updatePatientQuery, patientValues);
        await client.query(updateAppointmentQuery, appointmentValues);
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating records:', error);
        res.status(500).json({ success: false, error: 'Error updating records' });
    } finally {
        client.release();
    }
}

exports.deleteAppointment = async (req, res) => {
    const appointmentId = req.params.id;
    console.log(appointmentId);
    try {
        await pool.query('DELETE FROM appointments WHERE appointment_id = $1', [appointmentId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.json({ success: false, error: 'Error deleting appointment' });
    }
}

//fetch tests
exports.fetchTests = async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT tests FROM Tests');
        client.release();
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// Add Test
exports.addTest = async (req, res) => {
    const { test } = req.body;

    try {
        const client = await pool.connect();
        await client.query('INSERT INTO Tests (tests) VALUES ($1)', [test]);
        client.release();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding test:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Fetch Diagnosis
exports.fetchDiagnosis = async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT diagnosis FROM Diagnosis');
        client.release();
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching diagnosis:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// Add Diagnosis
exports.addDiagnosis = async (req, res) => {
    const { diagnosis } = req.body;

    try {
        const client = await pool.connect();
        await client.query('INSERT INTO Diagnosis (diagnosis) VALUES ($1)', [diagnosis]);
        client.release();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding diagnosis:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
