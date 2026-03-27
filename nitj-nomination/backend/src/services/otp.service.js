const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');

// it generate the otp
const generateOTP = () => crypto.randomInt(1000, 9999).toString();


// bycrpt before storing
const hashOTP = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

// verify 
const verifyOTP = (plainOTP, hashedOTP) => bcrypt.compare(plainOTP, hashedOTP);

// expires the otp after 5 min
const getOTPExpiry = (minutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 5) =>
  new Date(Date.now() + minutes * 60 * 1000);

// check for expired otp
const isOTPExpired = (expiry) => Date.now() > new Date(expiry).getTime();


module.exports = { generateOTP, 
  hashOTP, 
  verifyOTP, 
  getOTPExpiry, 
  isOTPExpired 
};