const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');

router.get('/all-patients', patientController.getAllPatients);
router.get('/add-patient', patientController.addPatientPage);
router.post('/add-patients', patientController.addPatient);
router.get('/get-next-patient-id', patientController.getNextPatientId);
router.get('/patient-complaints', patientController.getComplaints);
router.get('/fetch-patients',patientController.fetchPatients);
router.put('/edit-patient/:id', patientController.updatePatient);

module.exports = router;
