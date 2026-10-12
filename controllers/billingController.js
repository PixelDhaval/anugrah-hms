const pool = require('../config/db');

exports.billingPage = async (req, res) => {
    const patientId = req.params.id
    res.render("opd-billing")
}