const pool = require('../config/db');

exports.createPrescription = (req, res) => {
    res.render('create-prescription');
};

exports.manageAppointment = (req, res) => {
    res.render('manage-appointment');
};

exports.getPatientRecords = async (req, res) => {
    try {
        function getTodayDate() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        const date = getTodayDate();
        const client = await pool.connect();

        const result = await client.query(`
            SELECT
                a.appointment_id,
                p.patient_id,
                p.name,
                p.age,
                p.address AS address,
                p.phone AS number,
                TO_CHAR(p.last_visited, 'YYYY-MM-DD') AS last_visited,
                a.status,
                d.name AS doctor_name
            FROM
                appointments a
            JOIN
                patients p ON a.patient_id = p.patient_id
            JOIN 
                doctors d ON a.doctor_id = d.doctor_id
            JOIN
                users u ON d.user_id = u.user_id
            WHERE
                a.appointment_date = $1
            ORDER BY
                CASE 
                    WHEN a.status = 'Scheduled' THEN 1
                    WHEN a.status = 'Re-schedule' THEN 2
                    WHEN a.status = 'Completed' THEN 3
                    ELSE 4
                END,
                p.last_visited DESC, p.last_visited_time DESC;
        `, [date]);
        
        client.release();
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching appointment data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllPatientRecords = async (req, res) => {
    try {
        function getTodayDate() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        const date = getTodayDate();
        const client = await pool.connect();
        try {
            if (!req.session.username) {
                throw new Error("Username not found in session.");
            }

            const result = await client.query(`
                SELECT
                    a.appointment_id,
                    p.patient_id,
                    p.name,
                    p.age,
                    p.address AS address,
                    p.phone AS number,
                    TO_CHAR(p.last_visited, 'YYYY-MM-DD') AS last_visited,
                    a.status,
                    d.name AS doctor_name
                FROM
                    appointments a 
                JOIN
                    patients p ON a.patient_id = p.patient_id
                JOIN 
                    doctors d ON a.doctor_id = d.doctor_id
                JOIN
                    users u ON d.user_id = u.user_id
                ORDER BY
                    a.appointment_id DESC;
            `, []);

            console.log(result.rows)

            res.json(result.rows);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching appointment data:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.updatePatientRecord = async (req, res) => {
    const { appointmentId, patientId, name, age, address, number, lastVisit, status } = req.body;

    const updatePatientQuery = `
        UPDATE patients
        SET name = $1, age = $2, address = $3, phone = $4, last_visited = $5
        WHERE patient_id = $6
    `;
    const patientValues = [name, age, address, number, lastVisit, patientId];

    const updateAppointmentQuery = `
        UPDATE appointments
        SET status = $1
        WHERE appointment_id = $2
    `;
    const appointmentValues = [status, appointmentId];

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(updatePatientQuery, patientValues);
        await client.query(updateAppointmentQuery, appointmentValues);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating records:', error);
        res.status(500).json({ success: false, error: 'Error updating records' });
    } finally {
        client.release();
    }
};

exports.deleteAppointment = async (req, res) => {
    const appointmentId = req.params.id;
    console.log(appointmentId);

    const client = await pool.connect();
    try {
        const patient_id = await client.query('DELETE FROM appointments WHERE appointment_id = $1 RETURNING patient_id', [appointmentId]);
        console.log(patient_id.rows[0].patient_id);

        await client.query('UPDATE patients SET appointment_status = $1 WHERE patient_id = $2', ["completed", patient_id.rows[0].patient_id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.json({ success: false, error: 'Error deleting appointment' });
    } finally {
        client.release();
    }
};

exports.fetchTests = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT tests FROM Tests');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.addTest = async (req, res) => {
    const { test } = req.body;

    const client = await pool.connect();
    try {
        await client.query('INSERT INTO Tests (tests) VALUES ($1)', [test]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding test:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.fetchDiagnosis = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT diagnosis FROM Diagnosis');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching diagnosis:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.addDiagnosis = async (req, res) => {
    const { diagnosis } = req.body;

    const client = await pool.connect();
    try {
        await client.query('INSERT INTO Diagnosis (diagnosis) VALUES ($1)', [diagnosis]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding diagnosis:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.fetchAdvice = async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('Connected to the database.');
        const result = await client.query('SELECT advice FROM advice');
        console.log('Fetched advice from database:', result.rows);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching advice:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.addAdvice = async (req, res) => {
    const { advice } = req.body;

    const client = await pool.connect();
    try {
        await client.query('INSERT INTO advice (advice) VALUES ($1)', [advice]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding advice:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.addPrescription = async (req, res) => {
    const { patientId, appointmentId, patientName, medication, dosage, medical_history, complaints, tests, diagnosis, advice, name, age, gender, weight, bp, pulse, spo2, temp, sugar, habits, electro_cg, echo_cg } = req.body;

    const client = await pool.connect();
    try {
        const doctorQuery = 'SELECT doctor_id FROM Appointments WHERE patient_id = $1 AND appointment_id = $2';
        const doctorResult = await client.query(doctorQuery, [patientId, appointmentId]);
        if (doctorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found for the given appointment' });
        }
        const doctorId = doctorResult.rows[0].doctor_id;

        const insertPrescriptionQuery = `
            INSERT INTO Prescriptions (patient_id, doctor_id, prescription_date, diagnosis, advice, medical_test, medicines, instructions, electro_cg, echo_cg)
            VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9) RETURNING prescription_id;
        `;
        const prescriptionValues = [patientId, doctorId, diagnosis.join(', '), advice.join(', '), tests.join(', '), medication, dosage, electro_cg, echo_cg];
        const prescriptionResult = await client.query(insertPrescriptionQuery, prescriptionValues);
        const prescriptionId = prescriptionResult.rows[0].prescription_id;

        const updateAppointmentQuery = 'UPDATE appointments SET complaints = $1, status = $2, bp = $5, pulse = $6, spo2 = $7, temp = $8, sugar = $9 WHERE patient_id = $3 AND appointment_id = $4';
        await client.query(updateAppointmentQuery, [complaints.join(', '), 'Completed', patientId, appointmentId, bp, pulse, spo2, temp, sugar]);

        const updatePatientQuery = 'UPDATE patients SET appointment_status=$1, medical_history = $3, name = $4, age = $5, gender = $6, weight = $7, habits = $8 WHERE patient_id = $2';
        await client.query(updatePatientQuery, ['billing', patientId, medical_history, patientName, age, gender, weight, habits]);

        res.json({ prescriptionId, message: 'Prescription generated successfully' });
    } catch (error) {
        console.error('Error generating prescription:', error);
        res.status(500).json({ error: 'Error generating prescription' });
    } finally {
        client.release();
    }
};

exports.updatePrescription = async (req, res) => {
    const { prescriptionId, patientId, appointmentId, diagnosis, advice, tests, medication, dosage, complaints, bp, pulse, spo2, temp, sugar, habits, electro_cg, echo_cg } = req.body;

    const client = await pool.connect();
    try {
        const doctorQuery = 'SELECT doctor_id FROM Appointments WHERE patient_id = $1 AND appointment_id = $2';
        const doctorResult = await client.query(doctorQuery, [patientId, appointmentId]);
        if (doctorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found for the given appointment' });
        }
        const doctorId = doctorResult.rows[0].doctor_id;

        const updatePrescriptionQuery = `
            UPDATE Prescriptions 
            SET doctor_id = $1, diagnosis = $2, advice = $3, medical_test = $4, medicines = $5, instructions = $6, electro_cg = $9, echo_cg = $10
            WHERE prescription_id = $7 AND patient_id = $8
        `;
        const prescriptionValues = [doctorId, diagnosis.join(', '), advice.join(', '), tests.join(', '), medication, dosage, prescriptionId, patientId, electro_cg, echo_cg];
        await client.query(updatePrescriptionQuery, prescriptionValues);

        const updateAppointmentQuery = 'UPDATE appointments SET complaints = $1, bp = $5, pulse = $6, spo2 = $7, temp = $4, sugar = $8 WHERE patient_id = $2 AND appointment_id = $3';
        await client.query(updateAppointmentQuery, [complaints.join(', '), patientId, appointmentId, temp, bp, pulse, spo2, sugar]);

        res.json({ message: 'Prescription updated successfully' });
    } catch (error) {
        console.error('Error updating prescription:', error);
        res.status(500).json({ error: 'Error updating prescription' });
    } finally {
        client.release();
    }
};



exports.getBillingPage = async (req, res) => {
    const patient_id = req.params.id;
    console.log(patient_id);
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT * FROM patients WHERE patient_id = $1", [patient_id]);
        const opd = await client.query("SELECT * FROM opd_services");
        console.log(result.rows[0]);
        console.log(opd.rows);
        if (result.rows.length > 0) {
            res.render('opd-billing', { data: result.rows[0], opd: opd.rows });
        } else {
            res.status(404).send('Patient not found');
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
};

exports.getOPDMaster = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT * FROM opd_services");
        console.log(result.rows);
        res.json({ data: result.rows });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.generateBill = async (req, res) => {
    const { patientId, particulars, discountAmount, discountPercent, paymentMethod, type, total } = req.body;
    console.log(particulars);
    let paymentDate = null;
    let paymentStatus = "pending";

    if (paymentMethod) {
        paymentDate = getTodayDate();
        paymentStatus = "completed";
    }

    const client = await pool.connect();
    try {
        const billId = await client.query("INSERT INTO bills (patient_id, date, type, particulars, discountAmt, discountPer, payment_status, payment_method, payment_date, total) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9) RETURNING bill_id", [patientId, type, JSON.stringify(particulars), discountAmount, discountPercent, paymentStatus, paymentMethod, paymentDate, total]);
        await client.query("UPDATE patients SET appointment_status = $1 WHERE patient_id = $2", ["completed", patientId]);
        await client.query("UPDATE prescriptions SET bill_id = $1 WHERE patient_id = $2 AND prescription_date = $3", [billId.rows[0].bill_id, patientId, getTodayDate()]);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, err: error });
        console.log(error);
    } finally {
        client.release();
    }
};

exports.editBill = async (req, res) => {
    const { patientId, particulars, discountAmount, discountPercent, paymentMethod, type, billId, total } = req.body;
    console.log(particulars);
    let paymentDate = null;
    let paymentStatus = "pending";

    if (paymentMethod) {
        paymentDate = getTodayDate();
        paymentStatus = "completed";
    }

    const client = await pool.connect();
    try {
        await client.query(
            `UPDATE bills
             SET 
                date = NOW(),
                type = $1,
                particulars = $2,
                discountAmt = $3,
                discountPer = $4,
                payment_status = $5,
                payment_method = $6,
                payment_date = $7,
                total = $8
             WHERE 
                bill_id = $9`,
            [type, JSON.stringify(particulars), discountAmount, discountPercent, paymentStatus, paymentMethod, paymentDate, total, billId]
        );
        await client.query("UPDATE patients SET appointment_status = $1 WHERE patient_id = $2", ["completed", patientId]);
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, err: error });
        console.log(error);
    } finally {
        client.release();
    }
};

exports.getOpdEntries = async (req, res) => {
    const month = req.body.month;
    console.log(month);
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                patients.patient_id AS patient_id, 
                patients.name AS name, 
                patients.doctor_assigned AS doctor, 
                to_char(bills.date, 'YYYY-MM-DD') AS date, 
                bills.total AS total,
                bills.payment_status AS status
            FROM 
                bills 
            JOIN 
                patients 
            ON 
                bills.patient_id = patients.patient_id 
            WHERE 
                to_char(bills.date, 'YYYY-MM') = $1`,
            [month] // Ensure month is in 'YYYY-MM' format
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.json({ success: false, err: err });
        console.log(err);
    } finally {
        client.release();
    }
};

exports.getCashReport = async (req, res) => {
    const date = req.body.date;
    console.log(date);
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                patients.patient_id AS patient_id, 
                patients.name AS name, 
                patients.doctor_assigned AS doctor, 
                to_char(bills.date, 'YYYY-MM-DD') AS date, 
                bills.total AS total,
                bills.payment_status AS status,
                bills.payment_method AS mode
            FROM 
                bills 
            JOIN 
                patients 
            ON 
                bills.patient_id = patients.patient_id 
            WHERE 
                bills.date = $1`,
            [date] // Ensure month is in 'YYYY-MM' format
        );

        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.json({ success: false, err: err });
        console.log(err);
    } finally {
        client.release();
    }
};

exports.getOpdBillList = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT b.*, to_char(b.date, 'YYYY-MM-DD') as date, p.name FROM bills b JOIN patients p ON b.patient_id = p.patient_id WHERE b.type = $1 ORDER BY b.bill_id DESC", ["opd"]);
        console.log(result.rows)
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.log(error);
        res.json({ success: false });
    } finally {
        client.release();
    }
};

exports.fetchOpdBilling = async (req, res) => {
    const billid = req.query.id;
    console.log("bill ID: ", billid)
    const client = await pool.connect();
    try {
        console.log(1)
        const result = await client.query("SELECT * FROM bills b JOIN patients p ON b.patient_id = p.patient_id WHERE b.bill_id = $1", [billid]);
        const data = result.rows[0];
        console.log("2")
        res.render("opd-billing-edit", data);
        console.log("3")
    } catch (error) {
        console.log(error);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
};

exports.getOpdParticular = async (req, res) => {
    const billid = req.params.id;
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT * FROM bills WHERE bill_id = $1", [billid]);
        res.json({ data: result.rows[0].particulars });
    } catch (error) {
        console.log(error);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
};

exports.changePaymentStatus = async (req, res) => {
    var { bill_id, paymentMethod, total } = req.body;
    var paymentStatus = "completed";
    const paymentDate = getTodayDate();
    const client = await pool.connect();
    try {
        var result  = await client.query("SELECT * FROM bills WHERE bill_id = $1", [bill_id]);
        if(result.rows[0].total > total + result.rows[0].recieved ){
            paymentStatus = "partially paid";
            total = parseInt(total)
            total += result.rows[0].recieved
        }
        await client.query("UPDATE bills SET payment_status = $1, payment_method = $2, payment_date = $3, recieved = $5 WHERE bill_id = $4", [paymentStatus, paymentMethod, paymentDate, bill_id, total]);
        res.json({ success: true });
    } catch (error) {
        console.log(error);
        res.json({ success: false });
    } finally {
        client.release();
    }
};

exports.addMedicine = async (req, res) => {
    console.log(req.body)
    const { name, nos, dose_qty, doses, timing } = req.body;
    const client = await pool.connect();
    try {
        const result = await client.query("INSERT INTO medicine (name, qty, dose_qty, doses, timing) VALUES ($1, $2, $3, $4, $5) RETURNING id", [name, nos, dose_qty, doses, timing]);
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.log(err);
        res.json({ success: false });
    } finally {
        client.release();
    }
};

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based, so add 1
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
exports.cancelAppointment = async (req, res) => {
    const patient_id = req.body.patient_id;
    const client = await pool.connect();
    
    console.log("Patient ID:", patient_id); // Debug: Log patient_id
    
    try {
        // Start a transaction
        await client.query('BEGIN');
        
        // Delete from appointments
        const deleteResult = await client.query(
            "DELETE FROM appointments WHERE patient_id = $1 AND (status = 'Re-schedule' OR status = 'Scheduled')",
            [patient_id]
        );
        console.log("Delete Result:", deleteResult.rowCount); // Debug: Log affected rows
        
        // Update patients
        const updateResult = await client.query(
            "UPDATE patients SET appointment_status = 'completed' WHERE patient_id = $1",
            [patient_id]
        );
        console.log("Update Result:", updateResult.rowCount); // Debug: Log affected rows
        
        // Commit the transaction
        await client.query('COMMIT');
        
        console.log("Transaction Completed");
        res.status(200).send("Appointment cancelled successfully.");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error during transaction:", err);
        res.status(500).send("An error occurred while cancelling the appointment.");
    } finally {
        client.release();
    }
};

exports.getPrevPrescription = async (req, res) => {
    const patient_id = req.body.patientId;
    console.log(req.body)
    const client = await pool.connect();
    try{
        const result = await client.query("SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY prescription_date DESC LIMIT 1", [patient_id])
        res.json({
            success: true,
            prescription: result.rows[0].instructions,
            data: result.rows[0]
        })
    } catch (err){
        console.log(err)
        res.json({
            success: false,
            err: err
        })
    } finally{
        client.release();
    }
}

exports.getBillData = async (req, res) => {
    const bill_id = req.query.bill_id;  // Use req.query for GET requests
    const query = `SELECT b.*, to_char(b.date, 'YYYY-MM-DD') as date, to_char(b.payment_date, 'YYYY-MM-DD') as payment_date, p.name FROM bills b LEFT JOIN patients p ON b.patient_id = p.patient_id WHERE bill_id = $1`;  // Use $1 for parameterized queries in PostgreSQL
    
    const client = await pool.connect();
    try {
        const result = await client.query(query, [bill_id]);
        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query failed" });
    } finally {
        client.release(); // Release the client back to the pool
    }
};

// Add new controller function for updating appointment status
exports.updateAppointmentStatus = async (req, res) => {
    const { appointmentId, status } = req.body;
    
    const client = await pool.connect();
    try {
        // Start a transaction
        await client.query('BEGIN');

        // Update appointment status
        await client.query(
            'UPDATE appointments SET status = $1 WHERE appointment_id = $2',
            [status, appointmentId]
        );

        // If status is 'transferred_to_ipd', update patient's appointment_status
        if (status === 'transferred_to_ipd') {
            await client.query(
                `UPDATE patients p 
                 SET appointment_status = 'ipd_transfer' 
                 FROM appointments a 
                 WHERE a.patient_id = p.patient_id 
                 AND a.appointment_id = $1`,
                [appointmentId]
            );
        }

        // Commit the transaction
        await client.query('COMMIT');
        
        res.json({ success: true });
    } catch (error) {
        // Rollback in case of error
        await client.query('ROLLBACK');
        console.error('Error updating appointment status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error updating appointment status'
        });
    } finally {
        client.release();
    }
};

exports.deleteBill = async (req, res) => {
    const billId = req.params.id;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // First get the patient_id from the bill
        const billResult = await client.query('SELECT patient_id FROM bills WHERE bill_id = $1', [billId]);
        if (billResult.rows.length === 0) {
            throw new Error('Bill not found');
        }
        
        const patientId = billResult.rows[0].patient_id;

        // Delete the bill
        await client.query('DELETE FROM bills WHERE bill_id = $1', [billId]);

        // Update patient status if needed
        await client.query(
            'UPDATE patients SET appointment_status = $1 WHERE patient_id = $2',
            ['completed', patientId]
        );

        await client.query('COMMIT');
        
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting bill:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Error deleting bill' 
        });
    } finally {
        client.release();
    }
};

exports.getTransactionReport = async (req, res) => {
    const { fromDate, toDate } = req.body;
    const client = await pool.connect();
    
    try {
        const result = await client.query(
            `SELECT 
                b.bill_id,
                b.patient_id, 
                p.name, 
                to_char(b.date, 'YYYY-MM-DD') AS date,
                b.total, 
                b.payment_status,
                b.payment_method,
                b.discountAmt,
                b.recieved,
                b.type
            FROM 
                bills b 
            JOIN 
                patients p 
            ON 
                b.patient_id = p.patient_id 
            WHERE 
                b.date >= $1 AND b.date <= $2::date + interval '1 day'
                AND (b.payment_status = 'completed' OR b.payment_status = 'partially paid')
            ORDER BY
                b.date DESC`,
            [fromDate, toDate]
        );

        res.json({ 
            success: true, 
            data: result.rows
        });
    } catch (err) {
        console.error('Error fetching transaction report:', err);
        res.json({ 
            success: false, 
            error: err.message 
        });
    } finally {
        client.release();
    }
};

exports.getTransactionReportPage = (req, res) => {
    res.render('report-transactions');
};

exports.getIpdTransactionReportPage = (req, res) => {
    res.render('report-ipd-transactions');
};

exports.getIpdTransactionReport = async (req, res) => {
    const { fromDate, toDate } = req.body;
    const client = await pool.connect();
    
    try {
        const result = await client.query(
            `SELECT 
                t.id,
                t.ipd_appointment_id,
                a.id as appointment_id,
                a.patient_id, 
                p.name as patient_name, 
                to_char(t.transaction_date, 'YYYY-MM-DD') AS date,
                t.amount, 
                t.payment_method,
                t.transaction_type,
                d.name as doctor_name
            FROM 
                ipd_appointment_transactions t
            JOIN 
                ipd_appointments a ON t.ipd_appointment_id = a.id
            JOIN 
                patients p ON a.patient_id = p.patient_id
            LEFT JOIN
                doctors d ON a.doctor_id = d.doctor_id
            WHERE 
                t.transaction_date >= $1 AND t.transaction_date <= $2::date + interval '1 day'
                AND t.transaction_type = 'credit'
            ORDER BY
                t.transaction_date DESC`,
            [fromDate, toDate]
        );

        res.json({ 
            success: true, 
            data: result.rows
        });
    } catch (err) {
        console.error('Error fetching IPD transaction report:', err);
        res.json({ 
            success: false, 
            error: err.message 
        });
    } finally {
        client.release();
    }
};