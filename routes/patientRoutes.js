const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const userController = require('../controllers/userController');


router.get('/all-patients', userController.checkAuth,  patientController.getAllPatients);
router.get('/add-patient', userController.checkAuth,  patientController.addPatientPage);
router.post('/add-patients', userController.checkAuth,  patientController.addPatient);
router.get('/get-next-patient-id', userController.checkAuth,  patientController.getNextPatientId);
router.get('/patient-complaints', userController.checkAuth,  patientController.getComplaints);
router.get('/fetch-patients', userController.checkAuth, patientController.fetchPatients);
router.put('/edit-patient/:id', userController.checkAuth,  patientController.updatePatient);
router.get('/fetch-complaints', userController.checkAuth,  patientController.fetchComplaints);
router.post('/add-complaint', userController.checkAuth,  patientController.addComplaint);

router.post('/add-appointment', userController.checkAuth,  patientController.addAppointment);

module.exports = router;
