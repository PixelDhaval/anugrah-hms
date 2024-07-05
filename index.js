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

app.get('/user-authentication', (req, res) => {
    res.render('user-authentication');
});

// POST route to handle form submission
app.post('/create-user', async (req, res) => {
    const { userName, firstName, lastName,pwd, dob, age, gender, phone, userType, permissions } = req.body;

    try {
        const client = await pool.connect();
        const result = await client.query(`
            INSERT INTO users (username, firstname, lastname, password, dob, age, gender, mobile, role,
                               patient, appointment, user_management, room_allotment, billing, reports, doctor)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
            userName, firstName, lastName, pwd, dob, age, gender, phone, userType,
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

//user-authentication
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

const PORT = process.env.SERVER_PORT;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
