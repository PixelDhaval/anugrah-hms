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

module.exports = {
    getMostCommonItems,
    addItem,
    removeItem
};
