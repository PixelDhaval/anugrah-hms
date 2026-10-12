const express = require('express');
const router = express.Router();
const db = require('../config/db');
const userController = require('../controllers/userController');

// Every route here edits IPD bill line items, so all of them need a login
router.use(userController.checkAuth);

// Create a new IPD appointment particular
router.post('/', async (req, res) => {
    try {
        const { ipd_appointment_id, indoor_service_id, rate, qty, remark } = req.body;
        const query = `
            INSERT INTO ipd_appointment_particulars 
            (ipd_appointment_id, indoor_service_id, rate, qty, remark) 
            VALUES ($1, $2, $3, $4, $5)
        `;
        await db.query(query, [ipd_appointment_id, indoor_service_id, rate, qty, remark]);
        res.json({ message: 'Particular added successfully' });
    } catch (error) {
        console.error('Error adding IPD particular:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update an IPD appointment particular
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { indoor_service_id, rate, qty, remark } = req.body;
        const query = `
            UPDATE ipd_appointment_particulars 
            SET indoor_service_id = $1, rate = $2, qty = $3, remark = $4
            WHERE id = $5
        `;
        await db.query(query, [indoor_service_id, rate, qty, remark, id]);
        res.json({ message: 'Particular updated successfully' });
    } catch (error) {
        console.error('Error updating IPD particular:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete an IPD appointment particular
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'DELETE FROM ipd_appointment_particulars WHERE id = $1';
        await db.query(query, [id]);
        res.json({ message: 'Particular deleted successfully' });
    } catch (error) {
        console.error('Error deleting IPD particular:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router; 