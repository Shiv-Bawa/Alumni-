const express = require('express');
const router  = express.Router();
const { registerVoter, verifyVoterOTP, loginVoter, getBallot, submitVote } = require('../controllers/voter.controller');
const { apiLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit.middleware');

router.use(apiLimiter);

// POST /api/voter/register   — fill details + send OTP to email
router.post('/register',    otpSendLimiter,   registerVoter);

// POST /api/voter/verify-otp — verify OTP → emailVerified = true, saved to DB
router.post('/verify-otp',  otpVerifyLimiter, verifyVoterOTP);

// POST /api/voter/login      — on voting page: enter email+rollNumber, verified against DB
router.post('/login',       apiLimiter,       loginVoter);

// GET  /api/voter/ballot/:voterId — fetch approved candidates
router.get('/ballot/:voterId', getBallot);

// POST /api/voter/submit-vote — cast vote (atomic)
router.post('/submit-vote', submitVote);

module.exports = router;
