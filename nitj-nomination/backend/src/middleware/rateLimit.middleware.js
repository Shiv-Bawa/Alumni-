const rateLimit = require('express-rate-limit');

const msg = (text) => ({ success: false, message: text });



/** General API limiter – 30 req / 15 min */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: msg('Too many requests. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});



/** OTP send – 3 requests / 10 min per email/IP */
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body?.['candidateDetails.email'] || req.ip,
  message: msg('Too many OTP requests. Please wait 10 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});



/** OTP verify – 5 attempts / 10 min per nominationId */
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.nominationId || req.ip,
  message: msg('Too many verification attempts. Please wait 10 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});


module.exports = { apiLimiter, 
  otpSendLimiter, 
  otpVerifyLimiter 
};