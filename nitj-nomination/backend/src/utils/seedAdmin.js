/**
 * Run once to create the first admin account:
 *   npm run seed:admin
 *
 * Reads ADMIN_USERNAME and ADMIN_PASSWORD from .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Admin    = require('../models/admin.model');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin@NITJ2024';

  await Admin.deleteOne({ username });
console.log("Old admin deleted (if existed)");

  const bcrypt = require('bcrypt');

const hashedPassword = await bcrypt.hash(password, 10);

const admin = new Admin({ 
  username, 
  passwordHash: hashedPassword 
});
  await admin.save();
  console.log(`✅ Admin created  →  username: "${username}"`);
  console.log('   Change the password after first login!\n');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
