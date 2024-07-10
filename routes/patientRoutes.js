const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');

router.get('/all-patients', patientController.getAllPatients);
router.get('/add-patient', patientController.addPatientPage);
router.get('/complaints', patientController.getComplaints);

module.exports = router;
