const pool = require('../config/db');

// Patient analytics for the dashboard. Deliberately no financial figures.
// All queries are read-only aggregates; "today" is the database's CURRENT_DATE.

// Age is free text ("47", "31 years, 1 months..."), so group on its leading number
const PATIENT_AGE = String.raw`substring(age from '^\s*(\d+)')::int`;

const queries = {
    patientCounts: `
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS new_this_month,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE) - interval '1 month'
                               AND created_at <  date_trunc('month', CURRENT_DATE))::int AS new_last_month
        FROM patients`,

    todaysAppointments: `
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status IN ('Scheduled', 'Re-schedule'))::int AS waiting,
            COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed
        FROM appointments
        WHERE appointment_date = CURRENT_DATE`,

    visitCounts: `
        SELECT
            COUNT(*) FILTER (WHERE appointment_date >= date_trunc('month', CURRENT_DATE))::int AS this_month,
            COUNT(*) FILTER (WHERE appointment_date >= date_trunc('month', CURRENT_DATE) - interval '1 month'
                               AND appointment_date <  date_trunc('month', CURRENT_DATE))::int AS last_month
        FROM appointments`,

    beds: `
        SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied
        FROM beds`,

    admitted: `
        SELECT
            ia.id, ia.patient_id, p.name AS patient_name, p.gender, p.age,
            d.name AS doctor_name, r.room_no, b.bed_no, rt.room_type,
            TO_CHAR(ia.appointment_date, 'DD-MM-YYYY') AS admission_date,
            (CURRENT_DATE - ia.appointment_date::date) AS days_admitted
        FROM ipd_appointments ia
        JOIN patients p ON p.patient_id = ia.patient_id
        LEFT JOIN doctors d ON d.doctor_id = ia.doctor_id
        LEFT JOIN beds b ON b.bed_id = ia.bed_id
        LEFT JOIN rooms r ON r.id = b.room_id
        LEFT JOIN room_types rt ON rt.id = r.room_type_id
        WHERE ia.status IS DISTINCT FROM 'discharged'
        ORDER BY ia.appointment_date`,

    dischargedThisMonth: `
        SELECT COUNT(*)::int AS count
        FROM ipd_appointments
        WHERE status = 'discharged' AND discharge_date >= date_trunc('month', CURRENT_DATE)`,

    // Every day/month in the window appears, including ones with zero visits
    visitsDaily: `
        SELECT TO_CHAR(day, 'YYYY-MM-DD') AS period,
               (SELECT COUNT(*) FROM appointments a WHERE a.appointment_date = day)::int AS visits,
               (SELECT COUNT(*) FROM patients p WHERE p.created_at::date = day)::int AS new_patients
        FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, interval '1 day') AS g(day)
        ORDER BY day`,

    visitsMonthly: `
        SELECT TO_CHAR(month, 'YYYY-MM') AS period,
               (SELECT COUNT(*) FROM appointments a
                 WHERE a.appointment_date >= month AND a.appointment_date < month + interval '1 month')::int AS visits,
               (SELECT COUNT(*) FROM patients p
                 WHERE p.created_at >= month AND p.created_at < month + interval '1 month')::int AS new_patients
        FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '11 months',
                             date_trunc('month', CURRENT_DATE), interval '1 month') AS g(month)
        ORDER BY month`,

    gender: `
        SELECT COALESCE(NULLIF(INITCAP(TRIM(gender)), ''), 'Not recorded') AS label, COUNT(*)::int AS count
        FROM patients
        GROUP BY 1
        ORDER BY 2 DESC`,

    ageGroups: `
        SELECT label, COUNT(*)::int AS count
        FROM (
            SELECT CASE
                WHEN ${PATIENT_AGE} IS NULL THEN 'Not recorded'
                WHEN ${PATIENT_AGE} < 18 THEN '0-17'
                WHEN ${PATIENT_AGE} < 31 THEN '18-30'
                WHEN ${PATIENT_AGE} < 46 THEN '31-45'
                WHEN ${PATIENT_AGE} < 61 THEN '46-60'
                ELSE '61+'
            END AS label
            FROM patients
        ) groups
        GROUP BY label
        ORDER BY CASE label WHEN '0-17' THEN 1 WHEN '18-30' THEN 2 WHEN '31-45' THEN 3
                            WHEN '46-60' THEN 4 WHEN '61+' THEN 5 ELSE 6 END`,

    // Complaints are stored as "BODYACHE, GIDDINESS, WEAKNESS"
    topComplaints: String.raw`
        SELECT UPPER(TRIM(c)) AS label, COUNT(*)::int AS count
        FROM appointments a,
             regexp_split_to_table(a.complaints, '\s*,\s*') AS c
        WHERE a.appointment_date >= CURRENT_DATE - 90
          AND TRIM(c) <> ''
        GROUP BY 1
        ORDER BY 2 DESC, 1
        LIMIT 8`,

    appointmentsByDoctor: `
        SELECT d.name AS label, COUNT(*)::int AS count
        FROM appointments a
        JOIN doctors d ON d.doctor_id = a.doctor_id
        WHERE a.appointment_date >= date_trunc('month', CURRENT_DATE)
        GROUP BY d.name
        ORDER BY 2 DESC, 1`,
};

exports.getDashboardData = async (req, res) => {
    try {
        const names = Object.keys(queries);
        const results = await Promise.all(names.map((name) => pool.query(queries[name])));
        const rows = Object.fromEntries(names.map((name, i) => [name, results[i].rows]));

        res.json({
            patients: rows.patientCounts[0],
            today: rows.todaysAppointments[0],
            visits: rows.visitCounts[0],
            beds: rows.beds[0],
            admitted: rows.admitted,
            dischargedThisMonth: rows.dischargedThisMonth[0].count,
            visitsDaily: rows.visitsDaily,
            visitsMonthly: rows.visitsMonthly,
            gender: rows.gender,
            ageGroups: rows.ageGroups,
            topComplaints: rows.topComplaints,
            appointmentsByDoctor: rows.appointmentsByDoctor,
        });
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        res.status(500).json({ error: 'Error loading dashboard data' });
    }
};
