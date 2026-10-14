const express = require('express');
const router = express.Router();
const medicineMergeController = require('../controllers/medicineMergeController');
const userController = require('../controllers/userController');

router.get('/merge-medicines', userController.checkAuth, medicineMergeController.page);
router.get('/api/merge-medicines', userController.checkAuth, medicineMergeController.list);
router.post('/api/merge-medicines', userController.checkAuth, medicineMergeController.merge);

module.exports = router;
