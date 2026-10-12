const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

router.get("/billing/:id", billingController.billingPage)
router.get("/billing", (req, res)=>{
    res.render("opd-billing");
})