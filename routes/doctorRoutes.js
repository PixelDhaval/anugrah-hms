const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const userController = require('../controllers/userController');

const multer = require('multer');
const upload = multer();

router.get('/add-doctor', userController.checkAuth, doctorController.addDoctorForm);
router.get('/all-doctors', userController.checkAuth, doctorController.getAllDoctors);
router.get('/getUserDetails/:userId', userController.checkAuth, doctorController.getUserDetails);
router.post('/updateUserAndDoctor/:userId', userController.checkAuth, upload.single('imageUpload'), doctorController.updateUserAndDoctor);
router.post('/updateDoctorCred/:userId', userController.checkAuth, upload.none(), doctorController.updateDoctorCredentials);

module.exports = router;
