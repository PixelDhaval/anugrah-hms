const pool = require('../config/db');
const { withTransaction } = pool;
const bcrypt = require('bcrypt'); // For hashing passwords

exports.addDoctorForm = (req, res) => {
    res.render('doctor-add');
};

exports.getAllDoctors = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT name, specialization, website, encode(doctor_img, 'base64') AS doctor_img, user_id
            FROM doctors WHERE delete = false
        `);


        result.rows.forEach(row => {
            if (row.doctor_img) {
                row.doctor_img = Buffer.from(row.doctor_img, 'base64').toString('base64');
            }
        });

        res.render('doctor-all', { doctors: result.rows });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).send('Internal server error');
    }
};

exports.getUserDetails = async (req, res) => {
    const userId = req.params.userId;
    try {
        const result = await pool.query(`
            SELECT u.user_id, u.username, u.firstname, u.lastname, u.dob, u.age, u.gender, u.mobile, 
                   d.website, d.email, d.specialization as speciality, d.doctor_img
            FROM users u
            LEFT JOIN doctors d ON u.user_id = d.user_id
            WHERE u.user_id = $1 AND u.delete = false
        `, [userId]);

        const user = result.rows[0];
        res.json(user);
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateUserAndDoctor = async (req, res) => {
    const userId = req.params.userId;
    const { Fname, Lname, birthdate, age, gender, phoneno, email, speciality, weburl } = req.body;
    const image = req.file;

    try {
        await withTransaction(async (client) => {
            const userUpdateQuery = `
                UPDATE users
                SET firstname = $1, lastname = $2, dob = $3, age = $4, gender = $5, mobile = $6
                WHERE user_id = $7
            `;
            const userUpdateValues = [Fname, Lname, birthdate, age, gender, phoneno, userId];
            await client.query(userUpdateQuery, userUpdateValues);

            let doctorUpdateQuery;
            let doctorUpdateValues;

            if (image) {
                doctorUpdateQuery = `
                    UPDATE doctors
                    SET name = $1, specialization = $2, website = $3, doctor_img = $4, email = $5
                    WHERE user_id = $6
                `;
                doctorUpdateValues = [
                    `${Fname} ${Lname}`,
                    speciality,
                    weburl,
                    image.buffer,
                    email,
                    userId
                ];
            } else {
                doctorUpdateQuery = `
                    UPDATE doctors
                    SET name = $1, specialization = $2, website = $3, email = $4
                    WHERE user_id = $5
                `;
                doctorUpdateValues = [
                    `${Fname} ${Lname}`,
                    speciality,
                    weburl,
                    email,
                    userId
                ];
            }

            await client.query(doctorUpdateQuery, doctorUpdateValues);
        });
        res.status(200).json({ message: 'Records updated successfully' });
    } catch (error) {
        console.error('Error updating records:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.updateDoctorCredentials = async (req, res) => {
    const { uname, password } = req.body;
    const { userId } = req.params;

    try {
        // Hash password before storing
        const hashedPassword = await bcrypt.hash(password, 10);

        const upd_query = 'UPDATE users SET username = $1, password = $2 WHERE user_id = $3';
        const upd_values = [uname, hashedPassword, userId];

        await pool.query(upd_query, upd_values);
        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating credentials:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
