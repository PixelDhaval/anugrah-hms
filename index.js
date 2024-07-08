const express = require('express');
const app = express();
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    user: process.env.USER_NAME,
    host: process.env.HOST_NAME,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    dialect: process.env.DB_DIALECT,
    port: process.env.PORT_NUMBER
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error in Connection', err);
    }
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            return console.error('Error executing Query', err);
        }
        console.log("connected to database!");
    });
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/create-users', (req, res) => {
    res.render('create-users');
});

app.get('/user-authentication', (req, res) => {
    res.render('user-authentication');
});

app.get('/add-doctor', (req, res) => {
    res.render('doctor-add');
});

app.get('/all-doctors', (req, res) => {
    res.render('doctor-all');
});

app.get('/manage-beds', (req, res) => {
    res.render('manage-beds');
});

app.get('/allot-room', (req, res) => {
    res.render('room-allot');
});

app.get('/all-room', (req, res) => {
    res.render('room-all');
});

app.get('/all-patients', (req, res) => {
    res.render('patient-all');
});

app.get('/add-patient', (req, res) => {
    res.render('patient-add');
});

app.get('/complaints', (req, res) => {
    res.render('patient-complaints');
});


// POST route to handle form submission
app.post('/create-user', async (req, res) => {
    const { userName, firstName, lastName,pwd, dob, age, gender, phone, userType, permissions } = req.body;

    try {
        const client = await pool.connect();
        const result = await client.query(`
            INSERT INTO users (username, firstname, lastname, password, dob, age, gender, mobile, role,
                               patient, appointment, user_management, room_allotment, billing, reports, doctor)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)RETURNING user_id
        `, [
            userName, firstName, lastName, pwd, dob, age, gender, phone, userType,
            permissions.includes('patients'), permissions.includes('appointments'),
            permissions.includes('user_management'), permissions.includes('room_allotment'),
            permissions.includes('billing'), permissions.includes('reports'), permissions.includes('doctors')
        ]);
        
        if (result.rows.length > 0) {
            const userId = result.rows[0].user_id;

            // If the user is a doctor, insert into the doctors table
            if (userType === 'doctor') {
                const doctorName = `${firstName} ${lastName}`;
                await client.query(`
                    INSERT INTO doctors (name, specialization, user_id)
                    VALUES ($1, $2,$3)
                `, [doctorName,'General',userId]);
            }

            res.json({ message: 'User created successfully' });
        } else {
            throw new Error('No user_id returned from INSERT operation');
        }
        client.release();
    } catch (err) {
        console.error('Error inserting data into PostgreSQL', err);
        res.status(500).json({ error: 'Error inserting data into PostgreSQL' });
    }
});

//user-authentication page
app.get('/showUsers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

//delete user
app.delete('/delete-user/:id', async (req, res) => {
    const id = req.params.id; 

    try {
        const client = await pool.connect();
        const result = await client.query('DELETE FROM users WHERE user_id = $1', [id]);
        res.json({ message: 'User deleted successfully' });
        client.release();
    } catch (err) {
        console.error('Error deleting data from PostgreSQL', err);
        res.status(500).json({ error: 'Error deleting data from PostgreSQL' });
    }
});

//update user
app.put('/updateUser', async (req, res) => {
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

        try {
            // Update user information in users table
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

            // Check if the user's role has changed to or from 'doctor'
            const isDoctor = role === 'doctor';
            const wasDoctorQuery = `
                SELECT EXISTS (SELECT 1 FROM doctors WHERE user_id = $1)
            `;
            const { rows: [{ exists }] } = await client.query(wasDoctorQuery, [user_id]);
            const wasDoctor = exists;

            // Handle doctor status change in doctors table
            if (isDoctor && !wasDoctor) {
                // Insert new record in doctors table
                const doctorName = `${firstname} ${lastname}`;
                const insertDoctorQuery = `
                    INSERT INTO doctors (name, specialization, user_id)
                    VALUES ($1, $2, $3)
                `;
                await client.query(insertDoctorQuery, [doctorName, 'General',user_id]);
            } else if (!isDoctor && wasDoctor) {
                // Delete record from doctors table
                const deleteDoctorQuery = `
                    DELETE FROM doctors WHERE user_id = $1
                `;
                await client.query(deleteDoctorQuery, [user_id]);
            } else if (isDoctor && wasDoctor) {
                // Update existing record in doctors table 
                const updateDoctorQuery = `
                    UPDATE doctors SET name = $1 WHERE user_id = $2
                `;
                const doctorName = `${firstname} ${lastname}`;
                await client.query(updateDoctorQuery, [doctorName, user_id]);
            }
            await client.query('COMMIT');

            res.json({ success: true });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error; 
        } finally {
            client.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating user' });
    }
});


//change password
app.put('/changePassword', async (req, res) => {
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
});




const PORT = process.env.SERVER_PORT;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
