const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');


const tables = ['complaint', 'diagnosis', 'tests', 'advice'];

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


tables.forEach(table => {
    router.post(`/api/add-${table}`, (req, res) => masterController.addItem(req, res, table));
    router.delete(`/api/remove-${table}/:itemId`, (req, res) => {
        masterController.removeItem(req, res, table);
    }); 
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

router.get('/opd-service-master',(req,res)=>{
    res.render('opd-service-master');
})

router.post('/add-service', masterController.addService);
router.get('/services', masterController.getAllServices);
router.put('/update-services/:code', masterController.updateService);
router.delete('/delete-service/:code',masterController.deleteService);
router.get('/get-next-service-code', masterController.getNextServiceCode);

module.exports = router;
