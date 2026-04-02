const rateLimit = require('express-rate-limit');

const msg = (text) => ({ success: false, message: text });

exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: msg('Too many requests. Please try again in 15 minutes.'),
});

exports.otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 3,
  keyGenerator: (req) => (req.body?.candidateEmail || req.body?.email || req.ip),
  message: msg('Too many OTP requests. Please wait 10 minutes.'),
});

exports.otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 10,
  message: msg('Too many verification attempts. Please wait 10 minutes.'),
});
