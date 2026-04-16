require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Admin = require('../models/admin.model');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'Admin@NITJ2024';

    // 🔥 Delete old admin
    await Admin.deleteOne({ username });
    console.log("Old admin deleted (if existed)");

    // 🔥 IMPORTANT: DO NOT HASH HERE (model will handle it)
    const admin = new Admin({
      username,
      passwordHash: password   // plain password
    });

    await admin.save();

    console.log(`✅ Admin created → username: "${username}"`);
    console.log(`🔑 Password → ${password}`);
    console.log('----------------------------------');

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();