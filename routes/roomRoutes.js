const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');


router.get('/manage-beds', userController.checkAuth, (req, res) => {
    res.render('manage-beds');
});

router.get('/allot-room', userController.checkAuth, (req, res) => {
    res.render('room-allot');
});

router.get('/all-room', userController.checkAuth, (req, res) => {
    res.render('room-all');
});

module.exports = router;
