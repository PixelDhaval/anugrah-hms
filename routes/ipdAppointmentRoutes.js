const express = require('express');
const router = express.Router();
const path = require('path');

const ipdAppointmentController = require('../controllers/ipdAppointmentController');
const userController = require('../controllers/userController');

// Serve static files from test-reports directory
router.use('/test-reports', express.static(path.join(__dirname, '../public/test_reports')));

router.get('/ipd-appointments', userController.checkAuth, ipdAppointmentController.getIpdAppointments);
router.get('/create-ipd-appointment', userController.checkAuth, ipdAppointmentController.createIpdAppointmentWindow);
router.post('/create-ipd-appointment', userController.checkAuth, ipdAppointmentController.createIpdAppointment);
router.get('/rooms-by-room-type/:roomTypeId', userController.checkAuth, ipdAppointmentController.getRoomsByRoomType);

router.get('/beds-by-room/:roomId', userController.checkAuth, ipdAppointmentController.getAvailableBedsByRoom);
router.get('/view-ipd-appointment/:id', userController.checkAuth, ipdAppointmentController.viewIpdAppointment);
router.get('/view-ipd-appointment/:id/bill', userController.checkAuth, ipdAppointmentController.getBillData);
router.post('/add-ipd-vital', userController.checkAuth, ipdAppointmentController.addIpdVital);

router.delete('/delete-ipd-appointment/:id', userController.checkAuth, ipdAppointmentController.deleteIpdAppointment);

router.post('/add-ipd-complaint', userController.checkAuth, ipdAppointmentController.addComplaint);
router.get('/ipd-complaints/:appointmentId', userController.checkAuth, ipdAppointmentController.getComplaints);


router.post('/ipd-prescription', userController.checkAuth, ipdAppointmentController.createPrescription);

// Notes routes
router.post('/ipd-appointment-notes', userController.checkAuth, ipdAppointmentController.createNote);
router.put('/ipd-appointment-notes/:id', userController.checkAuth, ipdAppointmentController.updateNote);
router.delete('/ipd-appointment-notes/:id', userController.checkAuth, ipdAppointmentController.deleteNote);

// Test routes
router.post('/ipd-appointment-tests', userController.checkAuth, ipdAppointmentController.createTest);
router.post('/ipd-appointment-tests/upload-report', userController.checkAuth, ipdAppointmentController.uploadReport);
router.delete('/ipd-appointment-tests/:id', userController.checkAuth, ipdAppointmentController.deleteTest);

// Add PDF viewer route
router.get('/view-pdf', userController.checkAuth, (req, res) => {
    res.render('view-pdf');
});

router.post('/ipd-appointment-transaction', userController.checkAuth, ipdAppointmentController.addTransaction);
router.put('/ipd-appointment-transaction/:id', userController.checkAuth, ipdAppointmentController.updateTransaction);
router.delete('/ipd-appointment-transaction/:id', userController.checkAuth, ipdAppointmentController.deleteTransaction);

router.post('/ipd-appointment-discharge', userController.checkAuth, ipdAppointmentController.dischargePatient);

// IPD Billing routes
router.get('/ipd-billing-list', userController.checkAuth, ipdAppointmentController.getIpdBillingList);
router.get('/get-ipd-bill-list', userController.checkAuth, ipdAppointmentController.getIpdBillList);
router.post('/change-ipd-payment-status', userController.checkAuth, ipdAppointmentController.changeIpdPaymentStatus);
router.get('/fetch-ipd-bill-by-id', userController.checkAuth, ipdAppointmentController.getIpdBillData);

// Investigation routes
router.get('/investigations', userController.checkAuth, ipdAppointmentController.getAllInvestigations);
router.post('/create-investigation', userController.checkAuth, ipdAppointmentController.createNewInvestigation);
router.post('/ipd-appointment-investigation', userController.checkAuth, ipdAppointmentController.createInvestigation);
router.put('/ipd-appointment-investigation/:id', userController.checkAuth, ipdAppointmentController.updateInvestigation);
router.delete('/ipd-appointment-investigation/:id', userController.checkAuth, ipdAppointmentController.deleteInvestigation);

module.exports = router;
