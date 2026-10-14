const express = require('express');
const router = express.Router();
const templateController = require('../controllers/prescriptionTemplateController');
const userController = require('../controllers/userController');

router.get('/prescription-templates', userController.checkAuth, templateController.page);
router.get('/api/prescription-templates', userController.checkAuth, templateController.list);
router.get('/api/prescription-templates/medicine-names', userController.checkAuth, templateController.medicineNames);
router.post('/api/prescription-templates', userController.checkAuth, templateController.create);
router.put('/api/prescription-templates/:id', userController.checkAuth, templateController.update);
router.delete('/api/prescription-templates/:id', userController.checkAuth, templateController.remove);

module.exports = router;
