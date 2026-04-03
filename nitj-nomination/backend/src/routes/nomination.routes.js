const express = require('express');
const router  = express.Router();
const upload  = require('../config/multer');
const { submitNomination, verifyNominationOTP, resendNominationOTP } = require('../controllers/nomination.controller');
const { apiLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit.middleware');

router.use(apiLimiter);

/* Only two file fields now — no proposer files */
const uploadFields = upload.fields([
  { name: 'paymentScreenshot', maxCount: 1 },
  { name: 'candidateProof',    maxCount: 1 },
]);

// POST /api/nomination/submit
router.post('/submit',     otpSendLimiter,   uploadFields, submitNomination);

// POST /api/nomination/verify-otp
router.post('/verify-otp', otpVerifyLimiter, verifyNominationOTP);

// POST /api/nomination/resend-otp
router.post('/resend-otp', otpSendLimiter,   resendNominationOTP);

module.exports = router;
