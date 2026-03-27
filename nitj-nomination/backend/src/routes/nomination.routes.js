const express = require('express');
const router  = express.Router();

const upload   = require('../config/multer');
const { submitNomination, verifyOTPAndConfirm, resendOTP } = require('../controllers/nomination.controller');
const { validateNomination, validateOTP } = require('../middleware/validation.middleware');
const { apiLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit.middleware');

router.use(apiLimiter);

const uploadFields = upload.fields([
  { name: 'paymentScreenshot',  maxCount: 1 },
  { name: 'proofOfAssociation', maxCount: 1 },
]);


// Submit 
router.post('/submit',
      otpSendLimiter,
      uploadFields, 
      validateNomination, 
      submitNomination
);


// Verify OTP → confirm
router.post('/verify-otp',
      otpVerifyLimiter,
      validateOTP,  
      verifyOTPAndConfirm
);


// Resend OTP
router.post('/resend-otp', 
      otpSendLimiter,   
      resendOTP
);

module.exports = router;