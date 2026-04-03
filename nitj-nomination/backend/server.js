require('dotenv').config();
const express       = require('express');
const helmet        = require('helmet');
const compression   = require('compression');
const morgan        = require('morgan');
const cors          = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const path          = require('path');

const connectDB          = require('./src/config/database');
const nominationRoutes   = require('./src/routes/nomination.routes');
const voterRoutes        = require('./src/routes/voter.routes');
const adminRoutes        = require('./src/routes/admin.routes');
const { notFound, globalErrorHandler } = require('./src/middleware/error.middleware');

const app = express();
connectDB();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests from file://, Live Server (5500/5501), localhost
    const allowed = [
      'http://127.0.0.1:5500', 'http://127.0.0.1:5501',
      'http://localhost:5500',  'http://localhost:5501',
      'http://localhost:3000',
    ];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: false,
}));

app.use(compression());
app.use(mongoSanitize());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── Body parsers ──────────────────────────────────────────────────────────────
// Note: multer handles multipart/form-data for file routes.
// These parsers handle JSON and URL-encoded (admin login, OTP verify, etc.)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static: serve uploaded files ──────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/nomination', nominationRoutes);
app.use('/api/voter',      voterRoutes);
app.use('/api/admin',      adminRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 NITJAA Backend  →  http://localhost:${PORT}`);
  console.log(`📁 Uploads         →  ${path.join(__dirname, 'uploads')}`);
  console.log(`🌍 Env             →  ${process.env.NODE_ENV || 'development'}\n`);
});
