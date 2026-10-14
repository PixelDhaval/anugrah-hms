const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const session = require('express-session');
const methodOverride = require('method-override');
const util = require('util');
const { DatabaseError } = require('pg');

dotenv.config();

// Print Postgres errors as one readable line instead of dumping every
// internal field (length, severity, file: 'numutils.c', ...) to the terminal.
DatabaseError.prototype[util.inspect.custom] = function () {
  const extra = [this.detail, this.hint].filter(Boolean).join(' ');
  return `DatabaseError [${this.code}]: ${this.message}${extra ? ` (${extra})` : ''}`;
};

const userRoutes = require('./routes/userRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const roomRoutes = require('./routes/roomRoutes');
const patientRoutes = require('./routes/patientRoutes');
const masterRoutes = require('./routes/masterRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const bedRoutes = require('./routes/bedRoutes');
const ipdAppointmentRoutes = require('./routes/ipdAppointmentRoutes');
const ipdAppointmentParticularRoutes = require('./routes/ipdAppointmentParticularRoutes');
const prescriptionTemplateRoutes = require('./routes/prescriptionTemplateRoutes');
const medicineMergeRoutes = require('./routes/medicineMergeRoutes');

const app = express();
app.use(methodOverride('_method'));

// Set up session middleware
app.use(session({
  secret: 'abcd', // Replace with your secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const fileUpload = require('express-fileupload');
app.use(fileUpload());

// Set up view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));

// Lets the shared navbar highlight the current page
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

// Route handlers
app.use('/', userRoutes);
app.use('/', doctorRoutes);
app.use('/', roomRoutes);
app.use('/', patientRoutes);
app.use('/', masterRoutes);
app.use('/', appointmentRoutes);
app.use('/', bedRoutes);
app.use('/', ipdAppointmentRoutes);
app.use('/', prescriptionTemplateRoutes);
app.use('/', medicineMergeRoutes);
app.use('/ipd-appointment-particulars', ipdAppointmentParticularRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Bad JSON:', err.message);
    res.status(400).send('Bad request: Invalid JSON');
  } else {
    next(err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
