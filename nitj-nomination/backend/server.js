require('dotenv').config();
const express     = require('express');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const cors        = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const path        = require('path');

const connectDB   = require('./src/config/database');
const nominationRoutes = require('./src/routes/nomination.routes');
const voterRoutes = require('./src/routes/voter.routes');
const { globalErrorHandler, notFound } = require('./src/middleware/error.middleware');

const app = express();

// 1. Connect to Database
connectDB();

// 2. CORS Configuration (Allowing Live Server and Localhost)
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5501', 'http://localhost:5501', 'http://127.0.0.1:5500'], 
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true,
}));

// 3. Security & Optimization
// app.use(helmet()); // Keep commented if it causes issues with local images
app.use(compression());
app.use(mongoSanitize());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 🔥 FIXED: Increased limits for Photo/PDF Uploads
// The previous 10kb limit was causing the silent "Server Error"
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 4. Static Files (For accessing uploaded candidate photos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. API Routes
app.use('/api/nomination', nominationRoutes);
app.use('/api/voter', voterRoutes);

// 6. Health Check
app.get('/api/health', (req, res) => res.json({ 
  status: 'ok', 
  message: 'Backend is live', 
  time: new Date() 
}));

// 7. Error Handling Middleware
app.use(notFound);
app.use(globalErrorHandler);

// 8. Server Startup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Backend running  →  http://localhost:${PORT}`);
  console.log(`📡 Env              →  ${process.env.NODE_ENV || 'development'}`);
  console.log(`📂 Uploads Path     →  ${path.join(__dirname, 'uploads')}\n`);
});