const express = require('express');
const router = express.Router();

router.get('/manage-beds', (req, res) => {
    res.render('manage-beds');
});

router.get('/allot-room', (req, res) => {
    res.render('room-allot');
});

router.get('/all-room', (req, res) => {
    res.render('room-all');
});

module.exports = router;
