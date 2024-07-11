// masterRoute.js
const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');

// Define tables and corresponding routes
const tables = ['complaint', 'diagnosis', 'tests', 'advice'];

// Route to render the master view with initial data
router.get('/master', async (req, res) => {
    try {
        const promises = tables.map(table => masterController.getMostCommonItems(table));
        const [complaints, diagnosis, tests, advice] = await Promise.all(promises);
        res.render('master', { complaints, diagnosis, tests, advice });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Failed to load data');
    }
});

// Dynamically create routes for each table
tables.forEach(table => {
    // POST route to add an item
    router.post(`/api/add-${table}`, (req, res) => masterController.addItem(req, res, table));
    
    // DELETE route to remove an item
    router.delete(`/api/remove-${table}/:itemId`, (req, res) => {
        masterController.removeItem(req, res, table);
    }); 
    // GET route to fetch most common items
    router.get(`/api/most-common-${table}`, async (req, res) => {
        try {
            const items = await masterController.getMostCommonItems(table);
            res.json(items);
        } catch (error) {
            console.error(`Error fetching most common ${table}:`, error);
            res.status(500).json({ error: `Failed to fetch most common ${table}` });
        }
    });
});

module.exports = router;
