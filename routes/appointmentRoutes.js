const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const patientController = require('../controllers/patientController');

router.get('/create-prescription', appointmentController.createPrescription);
router.get('/manage-appointment', appointmentController.manageAppointment);
router.get('/api/patient/:patientId/appointment/:appointmentId', patientController.getPatientData); 
router.post('/add-complaint', patientController.addComplaint);
router.get('/get-patient-records',appointmentController.getPatientRecords);
router.put('/update-appointment',appointmentController.updatePatientRecord);
router.delete('/delete-appointment/:id',appointmentController.deleteAppointment);
router.get('/prescription/fetch-tests', appointmentController.fetchTests);
router.post('/prescription/add-test', appointmentController.addTest);

router.get('/prescription/fetch-diagnosis', appointmentController.fetchDiagnosis);

router.post('/prescription/add-diagnosis', appointmentController.addDiagnosis);


module.exports = router;
