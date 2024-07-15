const pool = require('../config/db');

const getMostCommonItems = async (table) => {
    try {
        const queryText = `SELECT * FROM ${table}`;
        const { rows } = await pool.query(queryText);
        return rows || []; 
    } catch (error) {
        console.error(`Error fetching most common items from ${table}:`, error);
        throw error;
    }
};

const addItem = async (req, res, table) => {
    const { value } = req.body;

    try {
        const queryText = `INSERT INTO ${table} (${table}) VALUES ($1) RETURNING ${table}_id`;
        const { rows } = await pool.query(queryText, [value]);

        if (!rows || rows.length === 0) {
            throw new Error('Failed to add item');
        }

        const updatedItems = await getMostCommonItems(table);
        res.status(201).json({ item: rows[0], items: updatedItems });
    } catch (error) {
        console.error(`Error adding item to ${table}:`, error);
        res.status(500).json({ error: 'Failed to add item' });
    }
};
const removeItem = async (req, res, table) => {
    const { itemId } = req.params;
    console.log('Received delete request for item ID:', itemId, 'from table:', table);

    try {
        if (!itemId) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        const queryText = `DELETE FROM ${table} WHERE ${table}_id = $1`;
        const result = await pool.query(queryText, [itemId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const updatedItems = await getMostCommonItems(table);
        res.status(200).json({ message: 'Item removed successfully', items: updatedItems });
    } catch (error) {
        console.error(`Error removing item from ${table}:`, error);
        res.status(500).json({ error: 'Failed to remove item' });
    }
};

let nextServiceId=1;
const getNextServiceId = async () => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT MAX(CAST(SUBSTRING(code, 3) AS INT)) AS max_id FROM opd_services');
        let currentMaxId = result.rows[0].max_id || 0;
        nextServiceId = currentMaxId + 1;

        const nextId = 'SM' + String(nextServiceId).padStart(3, '0');
        return nextId;
    } catch (error) {
        console.error('Error fetching next Service code:', error);
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
};

const getNextServiceCode = async (req, res) => {
    try {
        const nextId = await getNextServiceId();
        res.json({ nextServiceId: nextId });
    } catch (error) {
        console.error('Error fetching next Service code:', error);
        res.status(500).send('Internal server error');
    }
};

const addService = async (req, res) => {
    const { code, service, rateForNewPatient, rateForOldPatient } = req.body;

    try {
        const queryText = 'INSERT INTO opd_services (code, opd_service, new_patient, old_patient) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [code, service, rateForNewPatient, rateForOldPatient];
        
        const result = await pool.query(queryText, values);
        
        res.status(201).json({ message: 'Service added successfully', service: result.rows[0] });
    } catch (error) {
        console.error('Error adding service:', error);
        res.status(500).json({ error: 'Failed to add service' });
    }
};

const getAllServices = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM opd_services');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
};
const updateService = async (req, res) => {
    const { code, service, rateForNewPatient, rateForOldPatient } = req.body;
    try {
        const queryText = 'UPDATE opd_services SET opd_service = $1, new_patient = $2, old_patient = $3 WHERE code = $4 RETURNING *';
        const values = [service, rateForNewPatient, rateForOldPatient, code];

        const result = await pool.query(queryText, values);

        res.json({ updatedService: result.rows[0] });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ error: 'Failed to update service' });
    }
};


const deleteService = async (req, res) => {
    const { code } = req.params; 

    try {
        const queryText = 'DELETE FROM opd_services WHERE code = $1';
        const result = await pool.query(queryText, [code]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.status(200).json({ message: 'Service deleted successfully' });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ error: 'Failed to delete service' });
    }
};

module.exports = {
    getMostCommonItems,
    addItem,
    removeItem,
    getNextServiceCode,
    addService,
    getAllServices,
    updateService,
    deleteService
};