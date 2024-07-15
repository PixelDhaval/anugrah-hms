const pool = require('../config/db');
const { format } = require('date-fns');

exports.getAllPatients = async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT name FROM doctors'); 
        client.release();

        const doctors = result.rows.map(row => row.name); 
        res.render('patient-all', { doctors: doctors });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).send('Internal server error');
    }
};

let nextPatientId = 1;
const getNextPatientId = async () => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT MAX(CAST(SUBSTRING(patient_id, 3) AS INT)) AS max_id FROM patients');
        client.release();

        
        let currentMaxId = result.rows[0].max_id || 0; 
        nextPatientId = currentMaxId + 1;

        const nextId = 'PT' + String(nextPatientId).padStart(3, '0');

        return nextId;
    } catch (error) {
        console.error('Error fetching next patient ID:', error);
        throw error; 
    }
};

exports.getNextPatientId = async (req, res) => {
    try {
        const nextId = await getNextPatientId();
        res.json({ nextPatientId: nextId });
    } catch (error) {
        console.error('Error fetching next patient ID:', error);
        res.status(500).send('Internal server error');
    }
};


exports.addPatientPage = async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT name FROM doctors');
        client.release();

        const doctors = result.rows.map(row => row.name);

        res.render('patient-add', { doctors: doctors });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).send('Internal server error');
    }
};

exports.addPatient = async (req, res) => {
    const { patient_id, Fname, Lname, birthdate, age, gender, phone, doctor_assigned, address, medical_history, refered_by } = req.body;
    const name = `${Fname} ${Lname}`;
    try {
        const client = await pool.connect();
        const query = `
            INSERT INTO patients (patient_id, name, age, gender, address, phone, medical_history,DOB,doctor_assigned,refered_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9,$10,CURRENT_TIMESTAMP)
        `;
        
        await client.query(query, [patient_id, name, age, gender, address, phone, medical_history,birthdate,doctor_assigned,refered_by]);
        client.release();

        res.json({ message: 'Patient added successfully' });
    } catch (error) {
        console.error('Error adding patient:', error); 
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.fetchPatients = async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        const patientData = await client.query(`
            SELECT patient_id, name, age, address, phone,
                   TO_CHAR(last_visited, 'YYYY-MM-DD') AS last_visited,appointment_status,
                   doctor_assigned
            FROM patients
        `);

        res.json(patientData.rows);
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) {
            client.release();
        }
    }
};
exports.updatePatient = async (req, res) => {
    const { id } = req.params;
    const { name, age, address, phone, last_visit, doctor_assigned } = req.body;

    try {
        // Format last_visit to yyyy/mm/dd format
        const formattedLastVisit = format(new Date(last_visit), 'yyyy-MM-dd');
        console.log(formattedLastVisit);

        const client = await pool.connect();
        const query = `
            UPDATE patients
            SET name = $1, age = $2, address = $3, phone = $4, last_visited = $5, doctor_assigned = $6
            WHERE patient_id = $7
        `;

        await client.query(query, [name, age, address, phone, formattedLastVisit, doctor_assigned, id]);
        client.release();

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.getComplaints = (req, res) => {
    res.render('patient-complaints');
};
