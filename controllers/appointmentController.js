const pool = require('../config/db');
const { paginate } = require('../utils/tableQuery');

exports.createPrescription = (req, res) => {
    res.render('create-prescription');
};

exports.manageAppointment = (req, res) => {
    res.render('manage-appointment');
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const APPOINTMENT_STATUSES = ['Scheduled', 'Re-schedule', 'Completed', 'Cancelled', 'transferred_to_ipd'];
// Age is free text ("47", "31 years, 1 months..."), so sort and filter on its leading number
const PATIENT_AGE = String.raw`substring(p.age from '^\s*(\d+)')::int`;

// Paging, sorting and filtering for both appointment tables (Tabulator remote mode).
// todayOnly limits rows to today's appointments (Manage Appointments page).
const appointmentTable = ({ todayOnly }) => ({
    select: `a.appointment_id, p.patient_id, p.name, p.age,
             p.address AS address, p.phone AS number,
             TO_CHAR(p.last_visited, 'YYYY-MM-DD') AS last_visited,
             TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
             a.status, d.name AS doctor_name`,
    from: `appointments a
           JOIN patients p ON a.patient_id = p.patient_id
           JOIN doctors d ON a.doctor_id = d.doctor_id
           JOIN users u ON d.user_id = u.user_id`,
    columns: {
        doctor_name: { sql: 'd.name' },
        patient_id: { sql: 'p.patient_id' },
        name: { sql: 'p.name' },
        age: {
            sql: PATIENT_AGE,
            // "40" for an exact age, "30-40" for a range
            filter: (value, add) => {
                const range = value.match(/^(\d+)\s*-\s*(\d+)$/);
                if (range) return `${PATIENT_AGE} BETWEEN ${add(Number(range[1]))} AND ${add(Number(range[2]))}`;
                if (/^\d+$/.test(value)) return `${PATIENT_AGE} = ${add(Number(value))}`;
                return null;
            },
        },
        address: { sql: 'p.address' },
        number: { sql: 'p.phone' },
        last_visited: { sql: 'p.last_visited', filter: false },
        appointment_date: { sql: 'a.appointment_date', filter: false },
        status: { sql: 'a.status', filter: 'exact' },
    },
    search: ['p.patient_id', 'p.name', 'p.phone', 'p.address', 'd.name'],
    extraFilters: (query, add) => {
        const conditions = [];
        if (todayOnly) {
            conditions.push(`a.appointment_date = ${add(getTodayDate())}`);
        } else {
            if (DATE_PATTERN.test(query.dateFrom)) conditions.push(`a.appointment_date >= ${add(query.dateFrom)}`);
            if (DATE_PATTERN.test(query.dateTo)) conditions.push(`a.appointment_date <= ${add(query.dateTo)}`);
        }
        if (APPOINTMENT_STATUSES.includes(query.status)) conditions.push(`a.status = ${add(query.status)}`);
        return conditions;
    },
    defaultSort: todayOnly
        // Patients still waiting first, then the most recent visit
        ? `CASE a.status WHEN 'Scheduled' THEN 1 WHEN 'Re-schedule' THEN 2 WHEN 'Completed' THEN 3 ELSE 4 END,
           p.last_visited DESC NULLS LAST, p.last_visited_time DESC NULLS LAST`
        : 'a.appointment_id DESC',
    tieBreaker: 'a.appointment_id DESC',
});

const todaysAppointments = appointmentTable({ todayOnly: true });
const allAppointments = appointmentTable({ todayOnly: false });

exports.getPatientRecords = async (req, res) => {
    try {
        res.json(await paginate(pool, req.query, todaysAppointments));
    } catch (error) {
        console.error('Error fetching appointment data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.getAllPatientRecords = async (req, res) => {
    try {
        res.json(await paginate(pool, req.query, allAppointments));
    } catch (error) {
        console.error('Error fetching appointment data:', error);
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

    const client = await pool.connect();
    try {
        const patient_id = await client.query('DELETE FROM appointments WHERE appointment_id = $1 RETURNING patient_id', [appointmentId]);

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
        const result = await client.query('SELECT advice FROM advice');
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
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT * FROM patients WHERE patient_id = $1", [patient_id]);
        const opd = await client.query("SELECT * FROM opd_services");
        if (result.rows.length > 0) {
            res.render('opd-billing', { data: result.rows[0], opd: opd.rows });
        } else {
            res.status(404).send('Patient not found');
        }
    } catch (error) {
        console.error('Error loading billing page:', error);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
};

exports.getOPDMaster = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT * FROM opd_services");
        res.json({ data: result.rows });
    } catch (error) {
        console.error('Error fetching OPD services:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
};

exports.generateBill = async (req, res) => {
    const { patientId, particulars, discountAmount, discountPercent, paymentMethod, type, total } = req.body;
    let paymentDate = null;
    let paymentStatus = "pending";

    if (paymentMethod) {
        paymentDate = getTodayDate();
        paymentStatus = "completed";
    }

    const client = await pool.connect();
    try {
        const billId = await client.query("INSERT INTO bills (patient_id, date, type, particulars, discountAmt, discountPer, payment_status, payment_method, payment_date, total) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9) RETURNING bill_id, bill_no", [patientId, type, JSON.stringify(particulars), discountAmount, discountPercent, paymentStatus, paymentMethod, paymentDate, total]);
        await client.query("UPDATE patients SET appointment_status = $1 WHERE patient_id = $2", ["completed", patientId]);
        await client.query("UPDATE prescriptions SET bill_id = $1 WHERE patient_id = $2 AND prescription_date = $3", [billId.rows[0].bill_id, patientId, getTodayDate()]);
        // bill_no is assigned by the bills_assign_bill_no trigger (e.g. 25-26/OPD/00042)
        res.json({ success: true, billId: billId.rows[0].bill_id, billNo: billId.rows[0].bill_no });
    } catch (error) {
        res.json({ success: false, err: error });
        console.error('Error generating bill:', error);
    } finally {
        client.release();
    }
};

exports.editBill = async (req, res) => {
    const { patientId, particulars, discountAmount, discountPercent, paymentMethod, type, billId, total } = req.body;
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
        console.error('Error editing bill:', error);
    } finally {
        client.release();
    }
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

// Monthly OPD report: every OPD bill dated in the given month (YYYY-MM)
exports.getOpdEntries = async (req, res) => {
    const { month } = req.body;
    if (!MONTH_PATTERN.test(month)) {
        return res.status(400).json({ success: false, error: 'Month must be YYYY-MM' });
    }
    try {
        // Date range instead of to_char(date) so an index on bills.date can be used
        const result = await pool.query(
            `SELECT
                b.bill_id,
                b.bill_no,
                p.patient_id,
                p.name,
                p.doctor_assigned AS doctor,
                TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
                b.total,
                b.recieved,
                b.payment_status AS status
            FROM bills b
            JOIN patients p ON b.patient_id = p.patient_id
            WHERE b.type = 'opd'
              AND b.date >= ($1 || '-01')::date
              AND b.date < ($1 || '-01')::date + interval '1 month'
            ORDER BY b.date, b.bill_id`,
            [month]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching OPD report:', err);
        res.status(500).json({ success: false, error: 'Error fetching OPD report' });
    }
};

// Daily cash collection: every OPD bill dated on the given day (YYYY-MM-DD).
// "recieved" is what was actually collected; "total" is the billed amount.
exports.getCashReport = async (req, res) => {
    const { date } = req.body;
    if (!DATE_PATTERN.test(date)) {
        return res.status(400).json({ success: false, error: 'Date must be YYYY-MM-DD' });
    }
    try {
        const result = await pool.query(
            `SELECT
                b.bill_id,
                b.bill_no,
                p.patient_id,
                p.name,
                p.doctor_assigned AS doctor,
                TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
                b.total,
                b.recieved,
                b.payment_status AS status,
                UPPER(b.payment_method) AS mode
            FROM bills b
            JOIN patients p ON b.patient_id = p.patient_id
            WHERE b.type = 'opd' AND b.date = $1
            ORDER BY b.bill_id`,
            [date]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching cash collection report:', err);
        res.status(500).json({ success: false, error: 'Error fetching cash collection report' });
    }
};

const PAYMENT_STATUSES = ['pending', 'partially paid', 'completed'];

// Paging, sorting and filtering for the OPD billing list (Tabulator remote mode).
// Leaves out b.particulars: the list only needs totals, not the line items.
const opdBillTable = {
    select: `b.bill_id, b.bill_no, TO_CHAR(b.date, 'YYYY-MM-DD') AS date, b.patient_id, p.name, p.phone,
             b.total, b.recieved, b.payment_status, b.payment_method`,
    from: 'bills b JOIN patients p ON b.patient_id = p.patient_id',
    columns: {
        bill_no: { sql: 'b.bill_no' },
        date: { sql: 'b.date', filter: false },
        patient_id: { sql: 'b.patient_id' },
        name: { sql: 'p.name' },
        total: { sql: 'b.total', filter: false },
        payment_status: { sql: 'b.payment_status', filter: false },
    },
    search: ['b.bill_no', 'b.patient_id', 'p.name', 'p.phone'],
    extraFilters: (query, add) => {
        const conditions = [`b.type = ${add('opd')}`];
        if (DATE_PATTERN.test(query.dateFrom)) conditions.push(`b.date >= ${add(query.dateFrom)}`);
        if (DATE_PATTERN.test(query.dateTo)) conditions.push(`b.date <= ${add(query.dateTo)}`);
        if (PAYMENT_STATUSES.includes(query.status)) conditions.push(`b.payment_status = ${add(query.status)}`);
        return conditions;
    },
    defaultSort: 'b.bill_id DESC',
    tieBreaker: 'b.bill_id DESC',
};

exports.getOpdBillList = async (req, res) => {
    try {
        res.json(await paginate(pool, req.query, opdBillTable));
    } catch (error) {
        console.error('Error fetching OPD bills:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.fetchOpdBilling = async (req, res) => {
    const billid = req.query.id;
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT * FROM bills b JOIN patients p ON b.patient_id = p.patient_id WHERE b.bill_id = $1", [billid]);
        const data = result.rows[0];
        res.render("opd-billing-edit", data);
    } catch (error) {
        console.error('Error loading OPD bill:', error);
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
        console.error('Error fetching OPD bill particulars:', error);
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
        console.error('Error changing payment status:', error);
        res.json({ success: false });
    } finally {
        client.release();
    }
};

exports.addMedicine = async (req, res) => {
    const { name, nos, dose_qty, doses, timing } = req.body;
    const client = await pool.connect();
    try {
        const result = await client.query("INSERT INTO medicine (name, qty, dose_qty, doses, timing) VALUES ($1, $2, $3, $4, $5) RETURNING id", [name, nos, dose_qty, doses, timing]);
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error('Error adding medicine:', err);
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

    try {
        // Start a transaction
        await client.query('BEGIN');
        
        // Delete from appointments
        const deleteResult = await client.query(
            "DELETE FROM appointments WHERE patient_id = $1 AND (status = 'Re-schedule' OR status = 'Scheduled')",
            [patient_id]
        );
        
        // Update patients
        const updateResult = await client.query(
            "UPDATE patients SET appointment_status = 'completed' WHERE patient_id = $1",
            [patient_id]
        );
        
        // Commit the transaction
        await client.query('COMMIT');
        
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
    const client = await pool.connect();
    try{
        const result = await client.query("SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY prescription_date DESC LIMIT 1", [patient_id])
        // A first-time patient has no previous prescription: that's not an error
        const previous = result.rows[0] || null;
        res.json({
            success: true,
            prescription: previous ? previous.instructions : null,
            data: previous
        })
    } catch (err){
        console.error('Error fetching previous prescription:', err);
        res.status(500).json({
            success: false,
            error: 'Error fetching previous prescription'
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

// OPD transactions between two dates, both inclusive
exports.getTransactionReport = async (req, res) => {
    const { fromDate, toDate } = req.body;
    if (!DATE_PATTERN.test(fromDate) || !DATE_PATTERN.test(toDate)) {
        return res.status(400).json({ success: false, error: 'Dates must be YYYY-MM-DD' });
    }
    try {
        // bills.date is a DATE, so "<= toDate" already includes the whole last day
        const result = await pool.query(
            `SELECT
                b.bill_id,
                b.bill_no,
                b.patient_id,
                p.name,
                TO_CHAR(b.date, 'YYYY-MM-DD') AS date,
                b.total,
                b.payment_status,
                UPPER(b.payment_method) AS payment_method,
                b.discountamt AS "discountAmt",
                b.recieved,
                b.type
            FROM bills b
            JOIN patients p ON b.patient_id = p.patient_id
            WHERE b.type = 'opd'
              AND b.date >= $1 AND b.date <= $2
              AND b.payment_status IN ('completed', 'partially paid')
            ORDER BY b.date DESC, b.bill_id DESC`,
            [fromDate, toDate]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching transaction report:', err);
        res.status(500).json({ success: false, error: 'Error fetching transaction report' });
    }
};

exports.getTransactionReportPage = (req, res) => {
    res.render('report-transactions');
};

exports.getIpdTransactionReportPage = (req, res) => {
    res.render('report-ipd-transactions');
};

// IPD payments (credits) between two dates, both inclusive
exports.getIpdTransactionReport = async (req, res) => {
    const { fromDate, toDate } = req.body;
    if (!DATE_PATTERN.test(fromDate) || !DATE_PATTERN.test(toDate)) {
        return res.status(400).json({ success: false, error: 'Dates must be YYYY-MM-DD' });
    }
    try {
        // transaction_date is a TIMESTAMP: "< toDate + 1 day" covers the whole last day and nothing after it
        const result = await pool.query(
            `SELECT
                t.id,
                t.ipd_appointment_id,
                a.id AS appointment_id,
                a.bill_no,
                a.patient_id,
                p.name AS patient_name,
                TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS date,
                t.amount,
                UPPER(t.payment_method) AS payment_method,
                t.transaction_type,
                d.name AS doctor_name
            FROM ipd_appointment_transactions t
            JOIN ipd_appointments a ON t.ipd_appointment_id = a.id
            JOIN patients p ON a.patient_id = p.patient_id
            LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE t.transaction_date >= $1
              AND t.transaction_date < $2::date + interval '1 day'
              AND t.transaction_type = 'credit'
            ORDER BY t.transaction_date DESC, t.id DESC`,
            [fromDate, toDate]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Error fetching IPD transaction report:', err);
        res.status(500).json({ success: false, error: 'Error fetching IPD transaction report' });
    }
};