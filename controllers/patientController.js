const pool = require('../config/db');

exports.getAllPatients = (req, res) => {
    res.render('patient-all');
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

exports.getComplaints = (req, res) => {
    res.render('patient-complaints');
};
