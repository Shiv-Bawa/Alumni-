const bcrypt = require('bcryptjs');

/** Generate a random 4-digit OTP */
const generateOTP = () =>
  String(Math.floor(1000 + Math.random() * 9000));

/** Hash an OTP with bcrypt */
const hashOTP = (otp) => bcrypt.hash(otp, 10);

/** Compare plain OTP with hash */
const verifyOTP = (plain, hash) => bcrypt.compare(plain, hash);

/** Expiry date: now + minutes */
const getOTPExpiry = (minutes = 10) => new Date(Date.now() + minutes * 60 * 1000);

/** Check if expiry has passed */
const isOTPExpired = (expiry) => !expiry || new Date() > new Date(expiry);

module.exports = { generateOTP, hashOTP, verifyOTP, getOTPExpiry, isOTPExpired };
