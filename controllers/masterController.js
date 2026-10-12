const pool = require('../config/db');

const getMostCommonItems = async (table) => {
    try {
        const queryText = `SELECT * FROM ${table}`;
        const { rows } = await pool.query(queryText);
        return rows || [];
    } catch (error) {
        console.error(`Error fetching items from ${table}:`, error);
        throw error;
    }
};

const addItem = async (req, res, table) => {
    const { value } = req.body;

    try {
        const queryText = `INSERT INTO ${table} (${table}) VALUES ($1) RETURNING ${table}_id`;
        const { rows } = await pool.query(queryText, [value]);

        if (rows.length === 0) {
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

const getNextServiceId = async () => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT MAX(CAST(SUBSTRING(code, 3) AS INT)) AS max_id FROM opd_services');
        const currentMaxId = result.rows[0].max_id || 0;
        const nextServiceId = currentMaxId + 1;

        return 'SM' + String(nextServiceId).padStart(3, '0');
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

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

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

// Indoor Services Management
const getIndoorServices = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM indoor_services ORDER BY indoor_service_name');
        res.render('indoor-services', { services: result.rows });
    } catch (error) {
        console.error('Error fetching indoor services:', error);
        res.status(500).send('Error fetching indoor services');
    }
};

const createIndoorService = async (req, res) => {
    try {
        const { indoor_service_name, rate } = req.body;


        // Get the next ID to generate the code
        const nextIdResult = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM indoor_services');
        const nextId = nextIdResult.rows[0].next_id;
        const code = `IMS${nextId.toString().padStart(3, '0')}`;

        const result = await pool.query(
            'INSERT INTO indoor_services (code, indoor_service_name, rate) VALUES ($1, $2, $3) RETURNING *',
            [code, indoor_service_name, rate]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating indoor service:', error);
        res.status(500).json({ error: 'Error creating indoor service' });
    }
};

const updateIndoorService = async (req, res) => {
    try {
        const { id } = req.params;
        const { indoor_service_name, rate } = req.body;


        const result = await pool.query(
            'UPDATE indoor_services SET indoor_service_name = $1, rate = $2 WHERE id = $3 RETURNING *',
            [indoor_service_name, rate, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating indoor service:', error);
        res.status(500).json({ error: 'Error updating indoor service' });
    }
};

const deleteIndoorService = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM indoor_services WHERE id = $1', [id]);
        res.json({ success: true });

    } catch (error) {
        console.error('Error deleting indoor service:', error);
        res.status(500).json({ error: 'Error deleting indoor service' });
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
    deleteService,
    getIndoorServices,
    createIndoorService,
    updateIndoorService,
    deleteIndoorService
};
