const pool = require('../config/db');
const { paginate } = require('../utils/tableQuery');

exports.getIpdAppointments = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ipd_appointments.*,
                patients.name as patient_name,
                beds.bed_no as bed_number,
                doctors.name as doctor_name,
                rooms.room_no as room_number,
                room_types.room_type as room_type,
                TO_CHAR(ipd_appointments.appointment_date, 'DD-MM-YYYY') as appointment_date
            FROM ipd_appointments 
            JOIN patients ON ipd_appointments.patient_id = patients.patient_id 
            JOIN beds ON ipd_appointments.bed_id = beds.bed_id 
            JOIN rooms ON beds.room_id = rooms.id 
            JOIN room_types ON rooms.room_type_id = room_types.id 
            JOIN doctors ON ipd_appointments.doctor_id = doctors.doctor_id
            ORDER BY ipd_appointments.appointment_date DESC`);

        res.render('ipd-appointments', { ipd_appointments: result.rows });
    } catch (error) {
        console.error('Error fetching IPD appointments:', error);
        res.status(500).send('Error fetching IPD appointments');
    }
};

exports.createIpdAppointmentWindow = async (req, res) => {
    try {

        // Get patients
        const patientsResult = await pool.query('SELECT patient_id, name FROM patients');
        const patients = patientsResult.rows;

        // Get room types
        const roomTypesResult = await pool.query('SELECT id, room_type FROM room_types');
        const roomTypes = roomTypesResult.rows;

        // Get available beds per room type (this is the crucial part)
        const availableBedsResult = await pool.query(
            `SELECT 
                rt.id as room_type_id, 
                rt.room_type, 
                COUNT(b.bed_id) as available_beds 
             FROM room_types rt
             JOIN rooms r ON rt.id = r.room_type_id
             LEFT JOIN beds b ON r.id = b.room_id AND b.status = 'available'
             GROUP BY rt.id, rt.room_type`
        );
        const availableBeds = availableBedsResult.rows;

        // Get doctors
        const doctorsResult = await pool.query('SELECT doctor_id, name FROM doctors');
        const doctors = doctorsResult.rows;


        res.render('create-ipd-appointment', {
            patients: patients,
            room_types: roomTypes,
            availableBeds: availableBeds, // Pass availableBeds to the view
            doctors: doctors
        });

    } catch (error) {
        console.error('Error rendering create-ipd-appointment:', error);
        res.status(500).send('Error rendering page');
    }
};

exports.createIpdAppointment = async (req, res) => {
    const { patient_name, appointment_date, room_type, room_number, bed_number, admission_reason, doctor_name } = req.body;
    try {
        // Admission and bed status must change together
        await pool.withTransaction(async (client) => {
            await client.query('INSERT INTO ipd_appointments (patient_id, appointment_date, bed_id, admission_reason, doctor_id) VALUES ($1, $2, $3, $4, $5)', [patient_name, appointment_date, bed_number, admission_reason, doctor_name]);
            await client.query('UPDATE beds SET status = $1 WHERE bed_id = $2', ['occupied', bed_number]);
        });
        res.redirect('/ipd-appointments');
    } catch (error) {
        console.error('Error creating IPD appointment:', error);
        res.status(500).send('Error creating IPD appointment');
    }
};

exports.getRoomsByRoomType = async (req, res) => {
    try {
        const roomTypeId = req.params.roomTypeId;
        
        // Modified query to include room details and count of available beds
        const result = await pool.query(
            `SELECT 
                r.id,
                r.room_no,
                r.rate,
                COUNT(CASE WHEN b.status = 'available' THEN 1 END) as available_beds,
                COUNT(b.bed_id) as total_beds
             FROM rooms r
             LEFT JOIN beds b ON r.id = b.room_id
             WHERE r.room_type_id = $1
             GROUP BY r.id, r.room_no, r.rate`,
            [roomTypeId]
        );

        // Send the rooms data as JSON
        res.json(result.rows.map(room => ({
            id: room.id,
            room_no: room.room_no,
            rate: room.rate,
            available_beds: parseInt(room.available_beds) || 0,
            total_beds: parseInt(room.total_beds) || 0
        })));

    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Error fetching rooms' });
    }
};

exports.getAvailableBedsByRoom = async (req, res) => {
    try {
        const roomId = req.params.roomId;
        
        // Query to get available beds for the selected room
        const result = await pool.query(
            `SELECT 
                bed_id,
                bed_no,
                status
             FROM beds
             WHERE room_id = $1 AND status = 'available'
             ORDER BY bed_no`,
            [roomId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching beds:', error);
        res.status(500).json({ error: 'Error fetching beds' });
    }
};

exports.viewIpdAppointment = async (req, res) => {
    try {
        var appointmentId = req.params.id;
        
        // Validate if appointmentId exists and is a valid number
        if (!appointmentId) {
            console.error('Missing appointment ID');
            return res.status(400).send('Missing appointment ID');
        }

        appointmentId = parseInt(appointmentId);

        const result = await pool.query(
            `SELECT 
                ipd_appointments.*,
                patients.patient_id as patient_id,
                patients.name as patient_name,
                patients.age as age,
                patients.gender as gender,
                patients.phone as contact,
                patients.address as address,
                beds.bed_no as bed_number,
                doctors.name as doctor_name,
                rooms.room_no as room_number,
                room_types.room_type as room_type,
                TO_CHAR(ipd_appointments.appointment_date, 'DD-MM-YYYY HH24:MI:SS') as appointment_date,
                TO_CHAR(ipd_appointments.appointment_date, 'YYYY-MM-DD HH24:MI') as appointment_date_form,
                TO_CHAR(ipd_appointments.discharge_date, 'DD-MM-YYYY HH24:MI:SS') as discharge_date,
                TO_CHAR(ipd_appointments.discharge_date, 'YYYY-MM-DD HH24:MI') as discharge_date_form,
                TO_CHAR(ipd_appointments.followup_date, 'DD-MM-YYYY') as followup_date,
                TO_CHAR(ipd_appointments.followup_date, 'YYYY-MM-DD') as followup_date_form
            FROM ipd_appointments 
            JOIN patients ON ipd_appointments.patient_id = patients.patient_id 
            JOIN beds ON ipd_appointments.bed_id = beds.bed_id 
            JOIN rooms ON beds.room_id = rooms.id 
            JOIN room_types ON rooms.room_type_id = room_types.id 
            JOIN doctors ON ipd_appointments.doctor_id = doctors.doctor_id 
            WHERE ipd_appointments.id = $1`, 
            [appointmentId]
        );

        // Get investigations for dropdown
        const investigations = await pool.query(
            `SELECT id, investigation_name FROM investigations ORDER BY investigation_name ASC`
        );

        // Get appointment investigations
        const appointmentInvestigations = await pool.query(
            `SELECT 
                i.*,
                inv.investigation_name,
                TO_CHAR(i.investigation_time, 'DD-MM-YYYY HH24:MI:SS') as investigation_time
            FROM ipd_investigations i
            JOIN investigations inv ON i.investigation_id = inv.id
            WHERE i.ipd_appointment_id = $1
            ORDER BY i.investigation_time DESC`,
            [appointmentId]
        );

        // Get indoor services for the dropdown
        const indoor_services = await pool.query(
            `SELECT id, indoor_service_name, rate FROM indoor_services ORDER BY indoor_service_name ASC`
        );

        // Get appointment particulars
        const appointment_particulars = await pool.query(
            `SELECT 
                p.*,
                s.indoor_service_name
            FROM ipd_appointment_particulars p
            JOIN indoor_services s ON p.indoor_service_id = s.id
            WHERE p.ipd_appointment_id = $1
            ORDER BY p.id DESC`,
            [appointmentId]
        );

        const vitals = await pool.query(
            `SELECT ipd_vitals.*, users.firstname || ' ' || users.lastname as user_name, TO_CHAR(vital_time, 'DD-MM-YYYY HH24:MI:SS') as vital_time FROM ipd_vitals LEFT JOIN users ON ipd_vitals.user_id = users.user_id WHERE ipd_appointment = $1 ORDER BY ipd_vitals.vital_time DESC`,
            [appointmentId]
        );

        const complaints = await pool.query(
            `SELECT ipd_complaints.*, users.firstname || ' ' || users.lastname as user_name, TO_CHAR(complaint_time, 'DD-MM-YYYY HH24:MI:SS') as complaint_time FROM ipd_complaints LEFT JOIN users ON ipd_complaints.user_id = users.user_id WHERE ipd_appointment_id = $1 ORDER BY ipd_complaints.complaint_time DESC`,
            [appointmentId]
        );

        var opdHistory = await pool.query(
            `SELECT 
                p.*,
                d.name,
                TO_CHAR(p.prescription_date, 'DD-MM-YYYY') as prescription_date
            FROM prescriptions as p 
            LEFT JOIN doctors d ON p.doctor_id = d.doctor_id 
            WHERE p.patient_id = $1 
            ORDER BY p.prescription_date DESC`,
            [result.rows[0].patient_id]
        );

        // Fetch all medicines for the dropdown
        const medicines = await pool.query(
            `SELECT 
                id,
                name,
                qty as default_nos,
                dose_qty as default_dose_qty,
                doses as default_frequency,
                timing as default_duration,
                custom_doses as default_custom_doses,
                is_custom as default_is_custom
            FROM medicine 
            ORDER BY name ASC`
        );

        opdHistory.rows.forEach(row => {
            try {
                if (row.instructions) {
                    // Remove the outer curly braces
                    const withoutCurlyBraces = row.instructions.slice(2, -2);
                    // Split into array by ","
                    const medicineStrings = withoutCurlyBraces.split('","');
                    // Parse each medicine string after cleaning quotes
                    row.medicines = medicineStrings.map(medicine => {
                        const cleanMedicine = medicine.replace(/\\/g, '');
                        return JSON.parse(cleanMedicine);
                    });

                } else {
                    row.medicines = [];
                }
            } catch (err) {
                console.error('Error parsing medicines:', err);
                row.medicines = [];
            }
        });

        const ipdTreatment = await pool.query(
            `SELECT 
                t.*, 
                TO_CHAR(t.treatment_time, 'DD-MM-YYYY HH24:MI:SS') as treatment_time,
                u.firstname || ' ' || u.lastname as doctor_name,
                t.remarks 
            FROM ipd_treatment as t 
            LEFT JOIN users as u ON t.doctor_id = u.user_id 
            WHERE ipd_appointment_id = $1
            ORDER BY t.treatment_time DESC`,
            [appointmentId]
        );

        // Use Promise.all to handle all medicine queries concurrently
        const treatmentWithMedicines = await Promise.all(
            ipdTreatment.rows.map(async (treatment) => {
                const medicinesResult = await pool.query(
                    `SELECT p.*, m.name as medicine_name 
                    FROM ipd_prescriptions as p 
                    LEFT JOIN medicine as m ON p.medicine_id = m.id 
                    WHERE ipd_treatment_id = $1`,
                    [treatment.id]
                );
                return {
                    ...treatment,
                    medicines: medicinesResult.rows
                };
            })
        );

        // Fetch notes
        const notes = await pool.query(
            `SELECT 
                n.*,
                u.firstname || ' ' || u.lastname as user_name,
                TO_CHAR(n.created_at, 'DD-MM-YYYY HH24:MI:SS') as created_at,
                TO_CHAR(n.updated_at, 'DD-MM-YYYY HH24:MI:SS') as updated_at
            FROM ipd_appointment_notes n
            LEFT JOIN users u ON n.user_id = u.user_id
            WHERE n.ipd_appointment_id = $1
            ORDER BY n.created_at DESC`,
            [appointmentId]
        );

        // Fetch tests
        const tests = await pool.query(
            `SELECT tests_id, tests FROM tests ORDER BY tests ASC`
        );

        const appointmentTests = await pool.query(
            `SELECT 
                t.*,
                ts.tests as test_name
            FROM ipd_appointment_tests t
            LEFT JOIN tests ts ON t.test_id = ts.tests_id
            WHERE t.ipd_appointment_id = $1
            ORDER BY t.id DESC`,
            [appointmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('Appointment not found');
        }


        const transactionsResult = await pool.query(
            `SELECT 
                t.*,
                TO_CHAR(t.transaction_date, 'DD-MM-YYYY') as ipd_transaction_date,
                TO_CHAR(t.transaction_date, 'YYYY-MM-DD') as transaction_date,
                u.firstname || ' ' || u.lastname as user_name,
                SUM(CASE WHEN t.transaction_type = 'credit' THEN amount ELSE 0 END) OVER() as total_credit,
                SUM(CASE WHEN t.transaction_type = 'debit' THEN amount ELSE 0 END) OVER() as total_debit,
                SUM(CASE WHEN t.transaction_type = 'credit' THEN amount ELSE -amount END) OVER() as net_amount
            FROM ipd_appointment_transactions t
            LEFT JOIN users u ON t.user_id = u.user_id 
            WHERE t.ipd_appointment_id = $1 
            ORDER BY t.transaction_date DESC`,
            [appointmentId]
        );

        res.render('view-ipd-appointment', {
            appointment: result.rows[0],
            vitals: vitals.rows,
            complaints: complaints.rows,
            opdHistory: opdHistory.rows,
            medicines: medicines.rows,
            ipdTreatment: treatmentWithMedicines,
            notes: notes.rows,
            tests: tests.rows,
            appointmentTests: appointmentTests.rows,
            indoor_services: indoor_services.rows,
            appointment_particulars: appointment_particulars.rows,
            transactions: transactionsResult.rows,
            investigations: investigations.rows,
            appointmentInvestigations: appointmentInvestigations.rows
        });

    } catch (error) {
        console.error('Error viewing IPD appointment:', error);
        res.status(500).send('Error viewing appointment');
    }
};

exports.addIpdVital = async (req, res) => {
    try {
        const {
            appointment_id,
            bp,
            pulse,
            spo2,
            temperature,
            weight,
            height,
            sugar
        } = req.body;

        var user_id = req.session.user_id;

        
        const result = await pool.query(
            `INSERT INTO ipd_vitals 
            (ipd_appointment, bp, pulse, spo2, temp, weight, height, sugar, vital_time, user_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9)
            RETURNING *`,
            [appointment_id, bp, pulse, spo2, temperature, weight, height, sugar, user_id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error adding vital signs:', error);
        res.status(500).json({ error: 'Error adding vital signs' });
    }
};

exports.addComplaint = async (req, res) => {
    try {
        const { appointment_id, complaint } = req.body;
        const user_id = req.session.user_id; // Assuming you store user ID in session

        
        // Insert the complaint
        const result = await pool.query(
            `INSERT INTO ipd_complaints 
            (ipd_appointment_id, complaint_desp, user_id, complaint_time) 
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            RETURNING *`,
            [appointment_id, complaint, user_id]

        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error adding complaint:', error);
        res.status(500).json({ error: 'Error adding complaint' });
    }
};

exports.getComplaints = async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        
        const result = await pool.query(
            `SELECT 
                c.id,
                c.complaint,
                TO_CHAR(c.complaint_time, 'DD-MM-YYYY HH24:MI') as complaint_time,
                u.name as user_name
            FROM ipd_complaints c
            JOIN users u ON c.user_id = u.id
            WHERE c.ipd_appointment_id = $1 
            ORDER BY c.complaint_time DESC`,
            [appointmentId]
        );


        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ error: 'Error fetching complaints' });
    }
};

exports.createPrescription = async (req, res) => {
    try {
        const { patient_id, appointment_id, medicines, remarks } = req.body;
        const client = await pool.connect();

        // Start a transaction
        await client.query('BEGIN');

        try {
            // Insert the treatment record
            const treatmentResult = await client.query(
                `INSERT INTO ipd_treatment (ipd_appointment_id, treatment_time, doctor_id, remarks) 
                VALUES ($1, CURRENT_TIMESTAMP, $2, $3) RETURNING id`,
                [appointment_id, req.session.user_id, remarks]
            );

            const treatmentId = treatmentResult.rows[0].id;

            // Insert all medicines
            for (const medicine of medicines) {
                if (medicine.is_custom) {
                    await client.query(
                        `INSERT INTO ipd_prescriptions (ipd_treatment_id, medicine_id, nos, custom_doses, is_custom) 
                        VALUES ($1, $2, $3, $4, $5)`,
                        [treatmentId, medicine.id, medicine.nos, medicine.custom_doses, true]
                    );
                } else {
                    await client.query(
                        `INSERT INTO ipd_prescriptions (ipd_treatment_id, medicine_id, nos, dose_qty, doses, timing, is_custom) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [treatmentId, medicine.id, medicine.nos, medicine.dose_qty, medicine.doses, medicine.timing, false]
                    );
                }
            }

            // Commit the transaction
            await client.query('COMMIT');
            
            res.json({ success: true, id: treatmentId });
        } catch (err) {
            // If there's an error, roll back the transaction
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating prescription:', error);
        res.status(500).json({ error: 'Error creating prescription' });
    }
};

exports.createNote = async (req, res) => {
    try {
        const { appointment_id, note } = req.body;

        const result = await pool.query(
            `INSERT INTO ipd_appointment_notes 
            (ipd_appointment_id, user_id, note, created_at) 
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            RETURNING id`,
            [appointment_id, req.session.user_id, note]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Error creating note' });
    }
};

exports.updateNote = async (req, res) => {
    try {
        const noteId = req.params.id;
        const { note } = req.body;

        const result = await pool.query(
            `UPDATE ipd_appointment_notes 
            SET note = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2 AND user_id = $3
            RETURNING *`,
            [note, noteId, req.session.user_id]
        );


        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to update this note' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Error updating note' });
    }
};

exports.deleteNote = async (req, res) => {
    try {
        const noteId = req.params.id;

        const result = await pool.query(
            `DELETE FROM ipd_appointment_notes 
            WHERE id = $1 AND user_id = $2
            RETURNING id`,
            [noteId, req.session.user_id]
        );


        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to delete this note' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Error deleting note' });
    }
};

exports.createTest = async (req, res) => {
    try {
        const { appointment_id, test_id, note } = req.body;

        const result = await pool.query(
            `INSERT INTO ipd_appointment_tests 
            (ipd_appointment_id, test_id, note) 
            VALUES ($1, $2, $3)
            RETURNING id`,
            [appointment_id, test_id, note]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error creating test:', error);
        res.status(500).json({ error: 'Error creating test' });
    }
};

exports.uploadReport = async (req, res) => {
    try {
        if (!req.files || !req.files.report) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { test_id } = req.body;
        const report = req.files.report;
        const fileName = `${Date.now()}_${report.name}`;
        const filePath = `test_reports/${fileName}`;

        // Move file to the reports directory
        await report.mv(`public/${filePath}`);

        await pool.query(
            `UPDATE ipd_appointment_tests 
            SET file_path = $1 
            WHERE id = $2`,
            [fileName, test_id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error uploading report:', error);
        res.status(500).json({ error: 'Error uploading report' });
    }
};

exports.deleteTest = async (req, res) => {
    try {
        const testId = req.params.id;

        // Get file path before deleting
        const fileResult = await pool.query(
            'SELECT file_path FROM ipd_appointment_tests WHERE id = $1',
            [testId]
        );

        // Delete the test record
        await pool.query('DELETE FROM ipd_appointment_tests WHERE id = $1', [testId]);

        // If there was a file, delete it
        if (fileResult.rows[0]?.file_path) {
            const fs = require('fs');
            const filePath = `public/test_reports/${fileResult.rows[0].file_path}`;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting test:', error);
        res.status(500).json({ error: 'Error deleting test' });
    }
};

exports.addTransaction = async (req, res) => {
    try {
        const { appointment_id, amount, payment_method, transaction_date, transaction_type } = req.body;
        const user_id = req.session.user_id;

        const result = await pool.query(
            `INSERT INTO ipd_appointment_transactions 
            (ipd_appointment_id, amount, payment_method, transaction_date, transaction_type, user_id) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *`,
            [appointment_id, amount, payment_method, transaction_date, transaction_type, user_id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ error: 'Error adding transaction' });
    }
};

exports.updateTransaction = async (req, res) => {
    try {
        const { amount, payment_method, transaction_date, transaction_type } = req.body;
        const transaction_id = req.params.id;

        const result = await pool.query(
            `UPDATE ipd_appointment_transactions 
            SET amount = $1, payment_method = $2, transaction_date = $3, transaction_type = $4 
            WHERE id = $5 
            RETURNING *`,
            [amount, payment_method, transaction_date, transaction_type, transaction_id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Error updating transaction' });
    }
};

exports.deleteTransaction = async (req, res) => {
    try {
        const transaction_id = req.params.id;
        
        await pool.query(
            'DELETE FROM ipd_appointment_transactions WHERE id = $1',
            [transaction_id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Error deleting transaction' });
    }
};

exports.dischargePatient = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            appointment_id,
            discharge_date,
            discharge_type,
            discharge_summary,
            treatment_given,
            discharge_advice,
            followup_date,
            discharge_condition
        } = req.body;

        const user_id = req.session.user_id;

        // Insert discharge record
      

        // Update appointment status
        const result = await client.query(
            `UPDATE ipd_appointments 
            SET status = 'discharged', 
                discharge_date = $1, 
                discharge_type = $2,
                discharge_summary = $3,
                treatment_given = $4,
                discharge_advice = $5,
                followup_date = $6,
                discharge_condition = $7
            WHERE id = $8
            RETURNING patient_id`,
            [discharge_date, discharge_type, discharge_summary, treatment_given, discharge_advice, followup_date, discharge_condition, appointment_id]
        );

        // Update bed status to available
        await client.query(
            `UPDATE beds b 
            SET status = 'available' 
            FROM ipd_appointments a 
            WHERE a.bed_id = b.bed_id 
            AND a.id = $1`,
            [appointment_id]
        );


        await client.query(
            `UPDATE patients 
            SET appointment_status = 'completed' 
            WHERE patient_id = $1`,
            [result.rows[0].patient_id]
        );

        await client.query('COMMIT');
        res.json({ success: true });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error discharging patient:', error);
        res.status(500).json({ error: 'Error discharging patient' });
    } finally {
        client.release();
    }
};

exports.getBillData = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        
        // Get appointment details with patient and doctor info
        const result = await pool.query(
            `SELECT 
                ipd_appointments.*,
                patients.patient_id as patient_id,
                patients.name as patient_name,
                beds.bed_no as bed_number,
                doctors.name as doctor_name,
                rooms.room_no as room_number,
                room_types.room_type as room_type,
                TO_CHAR(ipd_appointments.appointment_date, 'DD-MM-YYYY') as appointment_date,
                TO_CHAR(ipd_appointments.discharge_date, 'DD-MM-YYYY HH24:MI:SS') as discharge_date
            FROM ipd_appointments 
            JOIN patients ON ipd_appointments.patient_id = patients.patient_id 
            JOIN beds ON ipd_appointments.bed_id = beds.bed_id 
            JOIN rooms ON beds.room_id = rooms.id 
            JOIN room_types ON rooms.room_type_id = room_types.id 
            JOIN doctors ON ipd_appointments.doctor_id = doctors.doctor_id 
            WHERE ipd_appointments.id = $1`,
            [appointmentId]
        );

        // Get appointment particulars
        const particularsResult = await pool.query(
            `SELECT 
                p.*,
                s.indoor_service_name
            FROM ipd_appointment_particulars p
            JOIN indoor_services s ON p.indoor_service_id = s.id
            WHERE p.ipd_appointment_id = $1
            ORDER BY p.id DESC`,
            [appointmentId]
        );


        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Return the data in JSON format
        res.json({
            success: true,
            data: {
                appointment: result.rows[0],
                particulars: particularsResult.rows
            }
        });

    } catch (error) {
        console.error('Error fetching bill data:', error);
        res.status(500).json({ error: 'Error fetching bill data' });
    }
};

// Investigation Controllers
exports.createInvestigation = async (req, res) => {
    try {
        const { appointment_id, investigation_id, results } = req.body;
        
        const result = await pool.query(
            `INSERT INTO ipd_investigations 
            (ipd_appointment_id, investigation_id, investigation_time, results) 
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
            RETURNING id`,
            [appointment_id, investigation_id, results]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Error creating investigation:', error);
        res.status(500).json({ error: 'Error creating investigation' });
    }
};

exports.updateInvestigation = async (req, res) => {
    try {
        const { results } = req.body;
        const investigation_id = req.params.id;
        
        const result = await pool.query(
            `UPDATE ipd_investigations 
            SET results = $1 
            WHERE id = $2
            RETURNING *`,
            [results, investigation_id]
        );


        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Investigation not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating investigation:', error);
        res.status(500).json({ error: 'Error updating investigation' });
    }
};

exports.deleteInvestigation = async (req, res) => {
    try {
        const investigation_id = req.params.id;
        
        const result = await pool.query(
            'DELETE FROM ipd_investigations WHERE id = $1 RETURNING id',
            [investigation_id]
        );


        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Investigation not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting investigation:', error);
        res.status(500).json({ error: 'Error deleting investigation' });
    }
};

// Create new investigation type
exports.createNewInvestigation = async (req, res) => {
    const client = await pool.connect();
    try {
        const { investigation_name } = req.body;
        
        // Check if investigation already exists
        const existingInvestigation = await client.query(
            'SELECT id FROM investigations WHERE LOWER(investigation_name) = LOWER($1)',
            [investigation_name]
        );

        if (existingInvestigation.rows.length > 0) {
            return res.json({
                success: true,
                id: existingInvestigation.rows[0].id,
                investigation_name: investigation_name,
                message: 'Investigation already exists'
            });
        }

        // Create new investigation
        const result = await client.query(
            `INSERT INTO investigations (investigation_name) 
            VALUES ($1) 
            RETURNING id, investigation_name`,
            [investigation_name]
        );

        res.json({ 
            success: true, 
            id: result.rows[0].id,
            investigation_name: result.rows[0].investigation_name,
            message: 'Investigation created successfully'
        });

    } catch (error) {
        console.error('Error creating new investigation:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error creating new investigation',
            details: error.message 
        });
    } finally {
        client.release();
    }
};

// Get all investigations
exports.getAllInvestigations = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT id, investigation_name FROM investigations ORDER BY investigation_name ASC'
        );

        res.json({
            success: true,
            investigations: result.rows
        });

    } catch (error) {
        console.error('Error fetching investigations:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching investigations',
            details: error.message
        });
    } finally {
        client.release();
    }
};

exports.deleteIpdAppointment = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get the appointment details first
        const appointmentResult = await client.query(
            'SELECT patient_id, bed_id FROM ipd_appointments WHERE id = $1',
            [req.params.id]
        );

        if (appointmentResult.rows.length === 0) {
            throw new Error('Appointment not found');
        }

        const { patient_id, bed_id } = appointmentResult.rows[0];

        // Delete related records first
        await client.query(
            'DELETE FROM ipd_vitals WHERE ipd_appointment = $1',
            [req.params.id]
        );

        await client.query(
            'DELETE FROM ipd_complaints WHERE ipd_appointment_id = $1',
            [req.params.id]
        );

        await client.query(
            'DELETE FROM ipd_treatment WHERE ipd_appointment_id = $1',
            [req.params.id]
        );

        await client.query(
            'DELETE FROM ipd_appointment_notes WHERE ipd_appointment_id = $1',
            [req.params.id]
        );

        await client.query(
            'DELETE FROM ipd_appointment_tests WHERE ipd_appointment_id = $1',
            [req.params.id]
        );

        await client.query(
            'DELETE FROM ipd_appointment_transactions WHERE ipd_appointment_id = $1',
            [req.params.id]
        );

        // Delete the main appointment record
        await client.query(
            'DELETE FROM ipd_appointments WHERE id = $1',
            [req.params.id]
        );

        // Update bed status to available
        await client.query(
            'UPDATE beds SET status = $1 WHERE bed_id = $2',
            ['available', bed_id]
        );

        // Update patient status
        await client.query(
            'UPDATE patients SET appointment_status = $1 WHERE patient_id = $2',
            ['completed', patient_id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'IPD appointment deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting IPD appointment:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error deleting IPD appointment',
            details: error.message 
        });
    } finally {
        client.release();
    }
};

exports.getIpdBillingList = async (req, res) => {
    res.render('ipd-billing-list');
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IPD_BILL_STATUSES = ['Admitted', 'Pending', 'Paid'];

// One row per IPD admission with its billed, paid and remaining amounts.
// bill_status: still admitted, or discharged with/without a balance left.
const IPD_BILL_SUMMARY = `(
    SELECT
        ia.id AS appointment_id,
        ia.bill_no,
        ia.patient_id,
        p.name AS patient_name,
        p.phone,
        ia.status AS appointment_status,
        ia.appointment_date::date AS admission_day,
        ia.discharge_date::date AS discharge_day,
        TO_CHAR(ia.appointment_date, 'YYYY-MM-DD') AS admission_date,
        TO_CHAR(ia.discharge_date, 'YYYY-MM-DD') AS discharge_date,
        COALESCE(particulars.total, 0) AS total_bill_amount,
        COALESCE(payments.total, 0) AS total_paid_amount,
        COALESCE(particulars.total, 0) - COALESCE(payments.total, 0) AS remaining_amount,
        CASE
            WHEN ia.status IS DISTINCT FROM 'discharged' THEN 'Admitted'
            WHEN COALESCE(particulars.total, 0) - COALESCE(payments.total, 0) <= 0 THEN 'Paid'
            ELSE 'Pending'
        END AS bill_status
    FROM ipd_appointments ia
    JOIN patients p ON ia.patient_id = p.patient_id
    LEFT JOIN (
        SELECT ipd_appointment_id, SUM(rate * qty) AS total
        FROM ipd_appointment_particulars
        GROUP BY ipd_appointment_id
    ) particulars ON particulars.ipd_appointment_id = ia.id
    LEFT JOIN (
        SELECT ipd_appointment_id,
               SUM(CASE WHEN transaction_type = 'credit' THEN amount
                        WHEN transaction_type = 'debit' THEN -amount
                        ELSE 0 END) AS total
        FROM ipd_appointment_transactions
        GROUP BY ipd_appointment_id
    ) payments ON payments.ipd_appointment_id = ia.id
) b`;

// Paging, sorting and filtering for the IPD billing list (Tabulator remote mode)
const ipdBillTable = {
    select: `b.appointment_id, b.bill_no, b.patient_id, b.patient_name, b.appointment_status,
             b.admission_date, b.discharge_date, b.total_bill_amount,
             b.total_paid_amount, b.remaining_amount, b.bill_status`,
    from: IPD_BILL_SUMMARY,
    columns: {
        bill_no: { sql: 'b.bill_no' },
        patient_id: { sql: 'b.patient_id' },
        patient_name: { sql: 'b.patient_name' },
        admission_date: { sql: 'b.admission_day', filter: false },
        discharge_date: { sql: 'b.discharge_day', filter: false },
        total_bill_amount: { sql: 'b.total_bill_amount', filter: false },
        total_paid_amount: { sql: 'b.total_paid_amount', filter: false },
        remaining_amount: { sql: 'b.remaining_amount', filter: false },
        bill_status: { sql: 'b.bill_status', filter: false },
    },
    search: ['b.bill_no', 'b.patient_id', 'b.patient_name', 'b.phone'],
    extraFilters: (query, add) => {
        const conditions = [];
        if (DATE_PATTERN.test(query.dateFrom)) conditions.push(`b.admission_day >= ${add(query.dateFrom)}`);
        if (DATE_PATTERN.test(query.dateTo)) conditions.push(`b.admission_day <= ${add(query.dateTo)}`);
        if (IPD_BILL_STATUSES.includes(query.status)) conditions.push(`b.bill_status = ${add(query.status)}`);
        return conditions;
    },
    defaultSort: 'b.admission_day DESC',
    tieBreaker: 'b.appointment_id DESC',
};

exports.getIpdBillList = async (req, res) => {
    try {
        res.json(await paginate(pool, req.query, ipdBillTable));
    } catch (error) {
        console.error('Error fetching IPD bill list:', error);
        res.status(500).json({ error: 'Error fetching IPD bill list' });
    }
};

exports.changeIpdPaymentStatus = async (req, res) => {
    const { appointment_id, amount, payment_method } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Insert new transaction
        await client.query(
            `INSERT INTO ipd_appointment_transactions 
            (ipd_appointment_id, amount, payment_method, transaction_date, transaction_type, user_id)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'credit', $4)`,
            [appointment_id, amount, payment_method, req.session.user_id]
        );

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating payment status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error updating payment status' 
        });
    } finally {
        client.release();
    }
};

exports.getIpdBillData = async (req, res) => {
    const appointment_id = req.query.appointment_id;
    const client = await pool.connect();
    
    try {
        // Get appointment and patient details
        const appointmentResult = await client.query(`
            SELECT 
                ia.*,
                p.name as patient_name,
                p.patient_id,
                d.name as doctor_name,
                TO_CHAR(ia.appointment_date, 'DD-MM-YYYY') as formatted_admission_date,
                TO_CHAR(ia.discharge_date, 'DD-MM-YYYY') as formatted_discharge_date
            FROM ipd_appointments ia
            JOIN patients p ON ia.patient_id = p.patient_id
            JOIN doctors d ON ia.doctor_id = d.doctor_id
            WHERE ia.id = $1
        `, [appointment_id]);

        // Get all particulars
        const particularsResult = await client.query(`
            SELECT 
                ap.*,
                ipd.indoor_service_name,
                ipd.rate
            FROM ipd_appointment_particulars ap
            JOIN indoor_services ipd ON ap.indoor_service_id = ipd.id
            WHERE ap.ipd_appointment_id = $1
            ORDER BY ap.id
        `, [appointment_id]);

        // Get all transactions
        const transactionsResult = await client.query(`
            SELECT 
                t.*,
                TO_CHAR(t.transaction_date, 'DD-MM-YYYY') as formatted_date,
                u.firstname || ' ' || u.lastname as user_name
            FROM ipd_appointment_transactions t
            LEFT JOIN users u ON t.user_id = u.user_id
            WHERE t.ipd_appointment_id = $1
            ORDER BY t.transaction_date DESC
        `, [appointment_id]);

        if (appointmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.json({ 
            success: true,
            data: {
                appointment: appointmentResult.rows[0],
                particulars: particularsResult.rows,
                transactions: transactionsResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching IPD bill data:', error);
        res.status(500).json({ error: 'Error fetching IPD bill data' });
    } finally {
        client.release();
    }
};
