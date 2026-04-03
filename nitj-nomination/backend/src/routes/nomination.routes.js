// route se start karna hai



const express = require('express');
const router  = express.Router();

const upload   = require('../config/multer');
// 1. ADD the Admin functions to your import line here:
const { 
  submitNomination, 
  verifyOTPAndConfirm, 
  resendOTP, 
  getAllNominations,      // <--- ADD THIS
  verifyCandidateByAdmin  // <--- ADD THIS
} = require('../controllers/nomination.controller');

const { validateNomination, validateOTP } = require('../middleware/validation.middleware');
const { apiLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit.middleware');

router.use(apiLimiter);

const uploadFields = upload.fields([
  { name: 'paymentScreenshot',  maxCount: 1 },
  { name: 'proofOfAssociation', maxCount: 1 },
]);

// --- EXISTING ROUTES ---
router.post('/submit', otpSendLimiter, uploadFields, validateNomination, submitNomination);
router.post('/verify-otp', otpVerifyLimiter, validateOTP, verifyOTPAndConfirm);
router.post('/resend-otp', otpSendLimiter, resendOTP);

// --- 2. ADD THESE ADMIN ROUTES AT THE BOTTOM ---

// GET /api/nomination/admin/all
router.get('/admin/all', getAllNominations);

// PATCH /api/nomination/admin/verify
router.patch('/admin/verify', verifyCandidateByAdmin);

module.exports = router;