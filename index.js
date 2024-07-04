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

// Route to render create-users.ejs
app.get('/create-users', (req, res) => {
    res.render('create-users');
});

// POST route to handle form submission
app.post('/create-user', async (req, res) => {
    const { userName, firstName, lastName, dob, age, gender, phone, userType, permissions } = req.body;

    try {
        const client = await pool.connect();
        const result = await client.query(`
            INSERT INTO users (username, firstname, lastname, dob, age, gender, mobile,
                patient, appointment, user_management, room_allotment, billing, reports, doctor)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
            userName, firstName, lastName, dob, age, gender, phone,
            permissions.includes('patients'), permissions.includes('appointments'),
            permissions.includes('user_management'), permissions.includes('room_allotment'),
            permissions.includes('billing'), permissions.includes('reports'), permissions.includes('doctors')
        ]);

        res.json({ message: 'User created successfully' });
        client.release();
    } catch (err) {
        console.error('Error inserting data into PostgreSQL', err);
        res.status(500).json({ error: 'Error inserting data into PostgreSQL' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
