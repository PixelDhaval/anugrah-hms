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



// Fetch Advice
exports.fetchAdvice = async (req, res) => {
    try {
        const client = await pool.connect();
        console.log('Connected to the database.');
        
        const result = await client.query('SELECT advice FROM advice');
        client.release();
        console.log('Fetched advice from database:', result.rows);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching advice:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


// Add Advice
exports.addAdvice = async (req, res) => {
    const { advice } = req.body;

    try {
        const client = await pool.connect();
        await client.query('INSERT INTO advice (advice) VALUES ($1)', [advice]);
        client.release();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding advice:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.addPrescription = async (req, res) => {
    const { patientId, appointmentId, patientName, medication, dosage, complaints, tests, diagnosis, advice } = req.body;

    try {
        // Fetch doctor_id from Appointments table based on patient_id and appointment_id
        const doctorQuery = 'SELECT doctor_id FROM Appointments WHERE patient_id = $1 AND appointment_id = $2';
        const doctorResult = await pool.query(doctorQuery, [patientId, appointmentId]);
        if (doctorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found for the given appointment' });
        }
        const doctorId = doctorResult.rows[0].doctor_id;

        // Insert data into Prescriptions table
        const insertPrescriptionQuery = `
            INSERT INTO Prescriptions (patient_id, doctor_id, prescription_date, diagnosis, advice, medical_test, medicines, instructions)
            VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7) RETURNING prescription_id;
        `;
        const prescriptionValues = [patientId, doctorId, diagnosis.join(', '), advice.join(', '), tests.join(', '), medication, dosage];
        const prescriptionResult = await pool.query(insertPrescriptionQuery, prescriptionValues);
        const prescriptionId = prescriptionResult.rows[0].prescription_id;

        // Update complaints in Appointments table
        const updateAppointmentQuery = 'UPDATE Appointments SET complaints = $1 WHERE patient_id = $2 AND appointment_id = $3';
        await pool.query(updateAppointmentQuery, [complaints.join(', '), patientId, appointmentId]);

        res.json({ prescriptionId, message: 'Prescription generated successfully' });
    } catch (error) {
        console.error('Error generating prescription:', error);
        res.status(500).json({ error: 'Error generating prescription' });
    }
};