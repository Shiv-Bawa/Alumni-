const mongoose = require('mongoose');

const connectDB = async () => {
  try {

    console.log("ENV CHECK:", process.env.MONGODB_URI);
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nitj_nominations');
    console.log(`MongoDB  →  ${conn.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
