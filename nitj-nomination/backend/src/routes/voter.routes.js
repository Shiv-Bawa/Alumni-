const express = require('express');
const router  = express.Router();

// 1. You are already importing these specific functions here
const {
  registerVoter,
  verifyVoterOTP,
  getBallotCandidates,
  submitVote,
  getVoterStatus,
} = require('../controllers/voter.controller');

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

// --- VOTER ROUTES ---

// Fixed: Removed "voterController." because the function is already imported above
router.post('/register', registerVoter); 

router.post('/verify-otp', otpVerifyLimiter, validateVoterOTP, verifyVoterOTP);

router.get('/ballot/:voterId', getBallotCandidates);

router.post('/submit-vote', validateVoteSubmission, submitVote);

router.get('/status/:voterId', getVoterStatus);


// --- ADMIN ROUTES ---

router.get('/admin/results', getAllNominations);

router.post('/admin/verify-candidate', verifyCandidateByAdmin);

module.exports = router;