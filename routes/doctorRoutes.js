const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const multer = require('multer');
const upload = multer();

router.get('/add-doctor', doctorController.addDoctorForm);
router.get('/all-doctors', doctorController.getAllDoctors);
router.get('/getUserDetails/:userId', doctorController.getUserDetails);
router.post('/updateUserAndDoctor/:userId', upload.single('imageUpload'), doctorController.updateUserAndDoctor);
router.post('/updateDoctorCred/:userId', upload.none(), doctorController.updateDoctorCredentials);

module.exports = router;
