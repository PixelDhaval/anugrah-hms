const pool = require('../config/db');

exports.createUser = async (req, res) => {
    const { userName, firstName, lastName, pwd, dob, age, gender, phone, userType, permissions } = req.body;

    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        
        const result = await client.query(`
            INSERT INTO users (username, firstname, lastname, password, dob, age, gender, mobile, role,
                               patient, appointment, user_management, room_allotment, billing, reports, doctor)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING user_id
        `, [
            userName, firstName, lastName, pwd, dob, age, gender, phone, userType,
            permissions.includes('patients'), permissions.includes('appointments'),
            permissions.includes('user_management'), permissions.includes('room_allotment'),
            permissions.includes('billing'), permissions.includes('reports'), permissions.includes('doctors')
        ]);

        if (result.rows.length > 0) {
            const userId = result.rows[0].user_id;

            if (userType === 'doctor') {
                const doctorName = `${firstName} ${lastName}`;
                await client.query(`
                    INSERT INTO doctors (name, specialization, user_id)
                    VALUES ($1, $2, $3)
                `, [doctorName, 'General', userId]);
            }

            await client.query('COMMIT');
            client.release();
            res.json({ message: 'User created successfully' });
        } else {
            await client.query('ROLLBACK');
            client.release();
            throw new Error('No user_id returned from INSERT operation');
        }
    } catch (err) {
        console.error('Error inserting data into PostgreSQL', err);
        res.status(500).json({ error: 'Error inserting data into PostgreSQL' });
    }
};

exports.showUsers = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.deleteUser = async (req, res) => {
    const id = req.params.id;

    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        await client.query('DELETE FROM doctors WHERE user_id = $1', [id]);
        await client.query('DELETE FROM users WHERE user_id = $1', [id]);
        await client.query('COMMIT');
        client.release();
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Error deleting data from PostgreSQL', err);
        res.status(500).json({ error: 'Error deleting data from PostgreSQL' });
    }
};

exports.updateUser = async (req, res) => {
    const {
        user_id,
        username,
        firstname,
        lastname,
        role,
        patient,
        appointment,
        user_management,
        room_allotment,
        billing,
        reports,
        doctor
    } = req.body;

    try {
        const client = await pool.connect();
        await client.query('BEGIN');

        const updateUserQuery = `
            UPDATE users 
            SET username = $1, firstname = $2, lastname = $3, 
                role = $4, patient = $5, appointment = $6, 
                user_management = $7, room_allotment = $8, 
                billing = $9, reports = $10, doctor = $11
            WHERE user_id = $12`;

        await client.query(updateUserQuery, [
            username, firstname, lastname, role, patient, appointment,
            user_management, room_allotment, billing, reports, doctor, user_id
        ]);

        const isDoctor = role === 'doctor';
        const wasDoctorQuery = `
            SELECT EXISTS (SELECT 1 FROM doctors WHERE user_id = $1)
        `;
        const { rows: [{ exists }] } = await client.query(wasDoctorQuery, [user_id]);
        const wasDoctor = exists;

        if (isDoctor && !wasDoctor) {
            const doctorName = `${firstname} ${lastname}`;
            const insertDoctorQuery = `
                INSERT INTO doctors (name, specialization, user_id)
                VALUES ($1, $2, $3)
            `;
            await client.query(insertDoctorQuery, [doctorName, 'General', user_id]);
        } else if (!isDoctor && wasDoctor) {
            const deleteDoctorQuery = `
                DELETE FROM doctors WHERE user_id = $1
            `;
            await client.query(deleteDoctorQuery, [user_id]);
        } else if (isDoctor && wasDoctor) {
            const updateDoctorQuery = `
                UPDATE doctors SET name = $1 WHERE user_id = $2
            `;
            const doctorName = `${firstname} ${lastname}`;
            await client.query(updateDoctorQuery, [doctorName, user_id]);
        }

        await client.query('COMMIT');
        client.release();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        await client.query('ROLLBACK');
        client.release();
        res.status(500).json({ success: false, message: 'Error updating user' });
    }
};

exports.changePassword = async (req, res) => {
    const { userId, newPassword } = req.body;
    try {
        const client = await pool.connect();
        const query = 'UPDATE users SET password = $1 WHERE user_id = $2';
        const values = [newPassword, userId];
        await client.query(query, values);
        client.release();
        res.json({ success: true });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Error changing password' });
    }
};
