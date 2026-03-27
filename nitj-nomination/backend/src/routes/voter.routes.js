const express = require('express');
const router  = express.Router();

const {
  registerVoter,
  verifyVoterOTP,
  getBallotCandidates,
  submitVote,
  getVoterStatus,
} = require('../controllers/voter.controller');

// Import the admin functions from the nomination controller
const { 
  getAllNominations, 
  verifyCandidateByAdmin 
} = require('../controllers/nomination.controller');

const {
  validateVoterRegistration,
  validateVoterOTP,
  validateVoteSubmission,
} = require('../middleware/VoterValidation.middleware');

const { apiLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit.middleware');

// Global rate limiter
router.use(apiLimiter);

// POST /api/voter/register     — register + send OTP
// 🔥 Verified against master dataset logic in controller
router.post('/register',     otpSendLimiter,   validateVoterRegistration, registerVoter);

// POST /api/voter/verify-otp   — verify OTP → set emailVerified = true
router.post('/verify-otp',   otpVerifyLimiter, validateVoterOTP,           verifyVoterOTP);

// GET  /api/voter/ballot/:voterId — fetch ballot (only if verified + not voted)
// 🔥 Only shows isAdminVerified: true candidates
router.get('/ballot/:voterId', getBallotCandidates);

// POST /api/voter/submit-vote  — cast vote (atomic transaction)
router.post('/submit-vote',  validateVoteSubmission, submitVote);

// GET  /api/voter/status/:voterId — check emailVerified / hasVoted
router.get('/status/:voterId', getVoterStatus);

// --- ADMIN ROUTES (NEW) ---

// GET /api/voter/admin/results — Admin-only access to election tallies
// Suggestion: Add an adminAuth middleware here for production security
router.get('/admin/results', getAllNominations);

// POST /api/voter/admin/verify-candidate — Admin manually approves/rejects
router.post('/admin/verify-candidate', verifyCandidateByAdmin);

module.exports = router;