const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const patientController = require('../controllers/patientController');
const userController = require('../controllers/userController');

router.get('/billing', appointmentController.getBillingPage)
router.get('/billing/:id', appointmentController.getBillingPage)
router.get('/create-prescription',userController.checkAuth,  appointmentController.createPrescription);
router.get('/manage-appointment',userController.checkAuth,  appointmentController.manageAppointment);
router.get('/api/patient/:patientId/appointment/:appointmentId',userController.checkAuth,  patientController.getPatientData); 
router.post('/add-complaint',userController.checkAuth,  patientController.addComplaint);
router.get('/get-patient-records',userController.checkAuth, appointmentController.getPatientRecords);
router.get('/get-all-patient-records',userController.checkAuth, appointmentController.getAllPatientRecords);
router.put('/update-appointment',userController.checkAuth, appointmentController.updatePatientRecord);
router.delete('/delete-appointment/:id',userController.checkAuth, appointmentController.deleteAppointment);
router.get("/all-appointment", (req, res) => {
    res.render("all-appointments")
})
router.post('/get-prev-prescription', appointmentController.getPrevPrescription)
router.get('/prescription/fetch-tests',userController.checkAuth,  appointmentController.fetchTests);
router.post('/prescription/add-test',userController.checkAuth,  appointmentController.addTest);
router.get('/prescription/fetch-diagnosis',userController.checkAuth,  appointmentController.fetchDiagnosis);
router.post('/prescription/add-diagnosis',userController.checkAuth,  appointmentController.addDiagnosis);
router.post('/prescription/add-advice',userController.checkAuth,  appointmentController.addAdvice);
router.get('/prescription/fetch-advice',userController.checkAuth,  appointmentController.fetchAdvice);
router.get('/get-opd-master', appointmentController.getOPDMaster)
router.get("/edit-prescription", (req, res)=>{
    res.render("view-prescription")
})
// //router.post('/prescription/generate-pdf', appointmentController.addPrescription);
// router.post('/prescription/generate-pdf', appointmentController.addPrescription);

router.post('/prescription/generate-pdf',userController.checkAuth,  appointmentController.addPrescription);
router.post('/prescription/update-pdf',userController.checkAuth,  appointmentController.updatePrescription);
router.post('/generate-bill', appointmentController.generateBill)
router.post('/edit-bill', appointmentController.editBill)
router.get('/report-opd', (req, res) => {
    res.render('report-opd');
})

router.post("/get-opd-entries", appointmentController.getOpdEntries)
router.get("/opd-billing-list", (req, res) => {
    res.render("opd-billing-list")
})
router.get("/get-opd-bill-list", appointmentController.getOpdBillList)
router.get("/opd-billing" , appointmentController.fetchOpdBilling)
router.get("/get-opd-particular/:id", appointmentController.getOpdParticular)
router.post("/change-payment-status", appointmentController.changePaymentStatus)
router.post("/add-medicine", appointmentController.addMedicine)
router.get("/report-cash-coll", (req, res) => {
    res.render("report-cash-coll")
})

router.post("/get-cash-collection", appointmentController.getCashReport)
router.post("/cancel-appointment", appointmentController.cancelAppointment)
router.get("/fetch-bill-by-id", appointmentController.getBillData)

// Add new route for updating appointment status
router.post('/update-appointment-status', userController.checkAuth, appointmentController.updateAppointmentStatus);

// Add this route
router.delete('/delete-bill/:id', userController.checkAuth, appointmentController.deleteBill);

// Transaction report routes
router.get('/report-transactions', userController.checkAuth, appointmentController.getTransactionReportPage);
router.post('/get-transaction-report', userController.checkAuth, appointmentController.getTransactionReport);

// IPD Transaction report routes
router.get('/report-ipd-transactions', userController.checkAuth, appointmentController.getIpdTransactionReportPage);
router.post('/get-ipd-transaction-report', userController.checkAuth, appointmentController.getIpdTransactionReport);

module.exports = router;
