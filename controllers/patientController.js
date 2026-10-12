const pool = require('../config/db');
const { paginate } = require('../utils/tableQuery');
const { format } = require('date-fns');

// Function to get all doctors for rendering patient view
exports.getAllPatients = async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM doctors'); 
        const doctors = result.rows.map(row => row.name); 
        res.render('patient-all', { doctors });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).send('Internal server error');
    }
};

// Function to get the next patient ID
const getNextPatientId = async () => {
    try {
        const currentDate = new Date();
        const year = String(currentDate.getFullYear()).slice(2);
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const prefix = `P${year}${month}`;
        const result = await pool.query(
            `SELECT MAX(CAST(SUBSTRING(patient_id, 6, 3) AS INT)) AS max_id 
            FROM patients 
            WHERE SUBSTRING(patient_id, 1, 5) = $1`, 
            [prefix]
        );
        let currentMaxId = result.rows[0].max_id || 100;
        const nextPatientId = currentMaxId + 1;
        return prefix + String(nextPatientId).padStart(3, '0');
    } catch (error) {
        console.error('Error fetching next patient ID:', error);
        throw error; 
    }
};

// Endpoint to get the next patient ID
exports.getNextPatientId = async (req, res) => {
    try {
        const nextId = await getNextPatientId();
        res.json({ nextPatientId: nextId });
    } catch (error) {
        console.error('Error fetching next patient ID:', error);
        res.status(500).send('Internal server error');
    }
};

// Render page to add a new patient
exports.addPatientPage = async (req, res) => {
    try {
        const result = await pool.query('SELECT doctor_id, name FROM doctors WHERE delete = false');
        const doctors = result.rows;
        res.render('patient-add', { doctors });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).send('Internal server error');
    }
};

// Add a new patient to the database
exports.addPatient = async (req, res) => {
    const { patient_id, Fname, Lname, birthdate, age, gender, phone, doctor_assigned, address, medical_history, refered_by } = req.body;
    const name = `${Fname} ${Lname}`;
    try {
        const query = `
            INSERT INTO patients (patient_id, name, age, gender, address, phone, medical_history, DOB, doctor_assigned, refered_by, created_at, appointment_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, 'completed')
        `;
        await pool.query(query, [patient_id, name, age, gender, address, phone, medical_history, birthdate, doctor_assigned, refered_by]);
        res.json({ message: 'Patient added successfully' });
    } catch (error) {
        console.error('Error adding patient:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Fetch patient data with details
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const APPOINTMENT_STATUSES = ['scheduled', 'billing', 'completed'];

// Paging, sorting and filtering for the All Patients table (Tabulator remote mode)
const patientTable = {
    select: `p.patient_id, p.name, p.age, p.address, p.phone, p.weight, p.gender,
             TO_CHAR(p.last_visited, 'YYYY-MM-DD') AS last_visited,
             p.appointment_status, p.doctor_assigned, d.doctor_id`,
    from: 'patients p LEFT JOIN doctors d ON p.doctor_assigned = d.name',
    columns: {
        patient_id: { sql: 'p.patient_id' },
        name: { sql: 'p.name' },
        phone: { sql: 'p.phone' },
        last_visited: { sql: 'p.last_visited', filter: false },
        doctor_assigned: { sql: 'p.doctor_assigned', filter: 'exact' },
    },
    search: ['p.patient_id', 'p.name', 'p.phone', 'p.address'],
    extraFilters: (query, add) => {
        const conditions = [];
        if (DATE_PATTERN.test(query.visitedFrom)) conditions.push(`p.last_visited >= ${add(query.visitedFrom)}`);
        if (DATE_PATTERN.test(query.visitedTo)) conditions.push(`p.last_visited <= ${add(query.visitedTo)}`);
        if (APPOINTMENT_STATUSES.includes(query.status)) conditions.push(`p.appointment_status = ${add(query.status)}`);
        return conditions;
    },
    // Patients waiting for their appointment first, then most recent visit
    defaultSort: `CASE WHEN p.appointment_status = 'scheduled' THEN 0 ELSE 1 END,
                  p.last_visited DESC NULLS LAST, p.last_visited_time ASC`,
    tieBreaker: 'p.patient_id DESC',
};

exports.fetchPatients = async (req, res) => {
    try {
        res.json(await paginate(pool, req.query, patientTable));
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update patient details
exports.updatePatient = async (req, res) => {
    const { id } = req.params;
    const { name, age, address, phone, last_visit, doctor_assigned, weight,gender } = req.body;
    try {
        const formattedLastVisit = format(new Date(last_visit), 'yyyy-MM-dd');
        const query = `
            UPDATE patients
            SET name = $1, age = $2, address = $3, phone = $4, last_visited = $5, doctor_assigned = $6, weight = $8, gender = $9
            WHERE patient_id = $7
        `;
        await pool.query(query, [name, age, address, phone, formattedLastVisit, doctor_assigned, id, weight, gender]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// Render complaints page
exports.getComplaints = (req, res) => {
    res.render('patient-complaints');
};

// Fetch all complaints
exports.fetchComplaints = async (req, res) => {
    try {
        const complaintData = await pool.query('SELECT complaint FROM complaint');
        res.json(complaintData.rows);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Add a new complaint
exports.addComplaint = async (req, res) => {
    const { complaint } = req.body;
    try {
        await pool.query('INSERT INTO complaint (complaint) VALUES ($1)', [complaint]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding complaint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Fetch patient data by ID and appointment ID
exports.getPatientData = async (req, res) => {
    const { patientId, appointmentId } = req.params;
    try {
        
        // Get patient information
        const patientResult = await pool.query('SELECT * FROM patients WHERE patient_id = $1', [patientId]);
        
        // Get current appointment information with vitals
        const appointmentResult = await pool.query(
            'SELECT complaints, medical, bp, pulse, spo2, temp, sugar FROM appointments WHERE appointment_id = $1 AND patient_id = $2', 
            [parseInt(appointmentId), patientId]
        );
        
        // Get previous prescriptions
        const prescriptionsQuery = `
            SELECT p.*, 
                   a.appointment_id, a.complaints, a.bp, a.pulse, a.spo2, a.temp, a.sugar
            FROM prescriptions p
            JOIN appointments a ON p.patient_id = a.patient_id AND DATE(p.prescription_date) = DATE(a.appointment_date)
            WHERE p.patient_id = $1
            ORDER BY p.prescription_date DESC
        `;
        const prescription = await pool.query(prescriptionsQuery, [patientId]);
        
        // Get medicine list
        const medList = await pool.query("SELECT * FROM medicine");
        
        // Structure previous prescriptions with their appointment data
        const oldPrescriptions = prescription.rows.map(row => {
            return {
                ...row,
                appointment_data: {
                    appointment_id: row.appointment_id,
                    complaints: row.complaints,
                    bp: row.bp,
                    pulse: row.pulse,
                    spo2: row.spo2,
                    temp: row.temp,
                    sugar: row.sugar
                }
            };
        });
        
        
        // Get complaints from current appointment
        const complaints = appointmentResult.rows.length > 0 ? appointmentResult.rows[0].complaints : '';
        
        res.json({
            patient: patientResult.rows[0],
            appointments: [complaints], 
            appointmentData: appointmentResult.rows[0] || {},
            prescription: prescription.rows[0],
            medList: medList.rows,
            oldPrescription: oldPrescriptions
        });
    } catch (error) {
        console.error('Error fetching patient data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Add an appointment for a patient
exports.addAppointment = async (req, res) => {
    const { patient_id, doctor_id, complaints, bp, pulse, spo2, temp, sugar} = req.body;
    const weight = req.body.weight || 0
    try {
        const patient = await pool.query('SELECT last_visited FROM patients WHERE patient_id = $1', [patient_id]);
        if (!patient.rows.length) {
            return res.status(400).json({ success: false, error: 'Patient not found' });
        }
        const lastVisited = patient.rows[0].last_visited;
        const status = lastVisited ? 'Re-schedule' : 'Scheduled';
        await pool.query(
            'INSERT INTO appointments (patient_id, doctor_id, complaints, status, bp, pulse, spo2, temp, sugar) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [patient_id, doctor_id, complaints, status, bp, pulse, spo2, temp, sugar]
        );
        await pool.query(`UPDATE patients SET appointment_status = $1, last_visited = NOW(), last_visited_time = NOW(), weight = $3 WHERE patient_id = $2`, ["scheduled", patient_id, weight]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding appointment:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
