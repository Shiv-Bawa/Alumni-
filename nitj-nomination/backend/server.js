require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const compression = require('compression');
const morgan     = require('morgan');
const cors       = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const path       = require('path');

const connectDB  = require('./src/config/database');
const nominationRoutes = require('./src/routes/nomination.routes');
const voterRoutes = require('./src/routes/voter.routes');
const { globalErrorHandler, notFound } = require('./src/middleware/error.middleware');

const app = express();

connectDB();

// security header 
//app.use(helmet());

// To allow frontend (Updated for development)
app.use(cors({
  // This allows both your Live Server and any future React/Next.js app
  origin: ['http://localhost:3000', 'http://127.0.0.1:5501', 'http://localhost:5501'], 
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], // Added PATCH for Admin approvals
  credentials: true,
}));



// middleware
app.use(compression());
app.use(mongoSanitize());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));



// uploading files 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



//  api routes 
app.use('/api/nomination', nominationRoutes);

app.use('/api/voter', voterRoutes);

// server check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));


// for erorr 
app.use(notFound);
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Backend running  →  http://localhost:${PORT}`);
  console.log(` Env             →  ${process.env.NODE_ENV || 'development'}\n`);
});
