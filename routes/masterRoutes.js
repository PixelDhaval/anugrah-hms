const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');

router.get('/master', async (req, res) => {
    try {
        const complaints = await masterController.getMostCommonComplaints();
        res.render('master', { complaints }); 
    } catch (error) {
        console.error('Error fetching most common complaints:', error);
        res.status(500).send('Failed to load complaints');
    }

});

router.post('/api/add-complaint', masterController.addComplaint);
router.delete('/api/remove-complaint/:complaintId', masterController.removeComplaint);
router.get('/api/most-common-complaints', masterController.getMostCommonComplaints);


module.exports = router;
