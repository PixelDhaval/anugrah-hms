const pool = require('../config/db');

exports.getAllPatients = (req, res) => {
    res.render('patient-all');
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

exports.getComplaints = (req, res) => {
    res.render('patient-complaints');
};
