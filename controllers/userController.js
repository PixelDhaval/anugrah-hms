const pool = require('../config/db');
const { withTransaction } = pool;
const bcrypt = require('bcrypt');
const session = require('express-session');

exports.checkAuth = (req, res, next) => {
    if (!req.session || !req.session.login) {
        res.render('login');
    } else {
        next();
    }
};

exports.createUser = async (req, res) => {
    const { userName, firstName, lastName, pwd, dob, age, gender, phone, userType, permissions } = req.body;
    const hashedPassword = pwd;

    try {
        await withTransaction(async (client) => {
            const result = await client.query(`
                INSERT INTO users (username, firstname, lastname, password, dob, age, gender, mobile, role,
                                   patient, appointment, user_management, room_allotment, billing, reports, doctor)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING user_id
            `, [
                userName, firstName, lastName, hashedPassword, dob, age, gender, phone, userType,
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
            } else {
                throw new Error('No user_id returned from INSERT operation');
            }
        });
        res.json({ message: 'User created successfully' });
    } catch (err) {
        console.error('Error inserting data into PostgreSQL', err);
        res.status(500).json({ error: 'Error inserting data into PostgreSQL' });
    }
};

exports.showUsers = async (req, res) => {
    try {
        // Never send passwords to the browser
        const result = await pool.query(`
            SELECT user_id, username, firstname, lastname, role, dob, age, mobile, gender,
                   patient, appointment, user_management, room_allotment, billing, reports, doctor, created_at
            FROM users
            WHERE delete = false
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.deleteUser = async (req, res) => {
    const id = req.params.id;

    try {
        const found = await withTransaction(async (client) => {
            const userCheckResult = await client.query('SELECT * FROM users WHERE user_id = $1', [id]);
            if (userCheckResult.rows.length === 0) {
                return false;
            }

            if (userCheckResult.rows[0].role === 'doctor') {
                await client.query('UPDATE doctors SET delete = $1 WHERE user_id = $2', [true, id]);
            }

            await client.query('UPDATE users SET delete = $1 WHERE user_id = $2', [true, id]);
            return true;
        });

        if (!found) {
            return res.status(404).json({ error: 'User not found' });
        }
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
        await withTransaction(async (client) => {
            const updateUserQuery = `
                UPDATE users 
                SET username = $1, firstname = $2, lastname = $3, 
                    role = $4, patient = $5, appointment = $6, 
                    user_management = $7, room_allotment = $8, 
                    billing = $9, reports = $10, doctor = $11
                WHERE user_id = $12
            `;

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
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({ success: false, message: 'Error updating user' });
    }
};

exports.changePassword = async (req, res) => {
    const { userId, newPassword } = req.body;
    try {
        const hashedPassword = newPassword;
        const query = 'UPDATE users SET password = $1 WHERE user_id = $2';
        await pool.query(query, [hashedPassword, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ success: false, message: 'Error changing password' });
    }
};

exports.authUser = async (req, res) => {
    const { user, pass } = req.body;
    try {
        const query = 'SELECT * FROM users WHERE username = $1 and delete = false';
        const values = [user];
        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            const match = pass == result.rows[0].password;
            if (match) {
                req.session.login = true;
                req.session.username = result.rows[0].username;
                req.session.name = `${result.rows[0].firstname} ${result.rows[0].lastname}`;
                req.session.gender = result.rows[0].gender;
                req.session.user_id = result.rows[0].user_id;
                res.json({ success: true });
            } else {
                res.json({ success: false, err: 'Invalid Password' });
            }
        } else {
            res.json({ success: false, err: 'User Doesn\'t Exist' });
        }
    } catch (err) {
        console.error('Database Error:', err);
        res.json({ success: false, err: `Database Error: ${err.message}` });
    }
};

exports.getUserName = async (req, res) => {
    try {
        res.json({ name: req.session.name, gender: req.session.gender });
    } catch (error) {
        console.error('Error retrieving user name:', error);
        res.status(500).json({ error: 'Error retrieving user name' });
    }
};

exports.logout = async (req, res) => {
    req.session.destroy();
    res.render('login');
};
