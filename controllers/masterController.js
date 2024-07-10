const pool = require('../config/db'); 

const getMostCommonComplaints = async () => {
    try {
        const queryText = 'SELECT * FROM complaints';
        const { rows } = await pool.query(queryText);

        if (!rows || rows.length === 0) {
            throw new Error('No complaints found');
        }

        return rows;
    } catch (error) {
        console.error('Error fetching most common complaints:', error);
        throw error;
    }
};

const addComplaint = async (req, res) => {
    const { complaint } = req.body;

    try {
        const queryText = 'INSERT INTO complaints (complaint) VALUES ($1) RETURNING *';
        const { rows } = await pool.query(queryText, [complaint]);

        if (!rows || rows.length === 0) {
            throw new Error('Failed to add complaint');
        }

        const updatedComplaints = await getMostCommonComplaints(); 
        res.status(201).json({ complaint: rows[0], complaints: updatedComplaints });
    } catch (error) {
        console.error('Error adding complaint:', error);
        res.status(500).json({ error: 'Failed to add complaint' });
    }
};

const removeComplaint = async (req, res) => {
    const { complaintId } = req.params;

    try {
        if (!complaintId) {
            return res.status(400).json({ error: 'Invalid complaint ID' });
        }

        const queryText = 'DELETE FROM complaints WHERE complaint_id = $1';
        const result = await pool.query(queryText, [complaintId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const updatedComplaints = await getMostCommonComplaints(); 
        res.status(200).json({ message: 'Complaint removed successfully', complaints: updatedComplaints });
    } catch (error) {
        console.error('Error removing complaint:', error);
        res.status(500).json({ error: 'Failed to remove complaint' });
    }
};


module.exports = {
    addComplaint,
    getMostCommonComplaints,
    removeComplaint
};
