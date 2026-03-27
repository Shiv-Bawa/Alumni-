const express = require('express');
const router  = express.Router();

const {
  registerVoter,
  verifyVoterOTP,
  getBallotCandidates,
  submitVote,
  getVoterStatus,
} = require('../controllers/voter.controller');

const {
  validateVoterRegistration,
  validateVoterOTP,
  validateVoteSubmission,
} = require('../middleware/VoterValidation.middleware');

const { apiLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit.middleware');

// Global rate limiter
router.use(apiLimiter);

// POST /api/voter/register     — register + send OTP
router.post('/register',     otpSendLimiter,   validateVoterRegistration, registerVoter);

// POST /api/voter/verify-otp   — verify OTP → set emailVerified = true
router.post('/verify-otp',   otpVerifyLimiter, validateVoterOTP,          verifyVoterOTP);

// GET  /api/voter/ballot/:voterId — fetch ballot (only if verified + not voted)
router.get('/ballot/:voterId', getBallotCandidates);

// POST /api/voter/submit-vote  — cast vote (atomic transaction)
router.post('/submit-vote',  validateVoteSubmission, submitVote);

// GET  /api/voter/status/:voterId — check emailVerified / hasVoted
router.get('/status/:voterId', getVoterStatus);

module.exports = router;