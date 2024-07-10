// routes/masterRoutes.js
const express = require('express');
const router = express.Router();

router.get('/master', (req, res) => {
    res.render('master');
});

module.exports = router;
