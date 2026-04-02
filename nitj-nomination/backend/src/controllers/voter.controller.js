const mongoose   = require('mongoose');
const Voter      = require('../models/voter.model');
const Nomination = require('../models/nomination.model');
const { Vote, VoteExecMember } = require('../models/vote.model');
const { generateOTP, hashOTP, verifyOTP, getOTPExpiry, isOTPExpired } = require('../services/otp.service');
const { sendVoterOTP } = require('../services/email.service');


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voter/register
// Voter fills details + OTP sent to email
// ─────────────────────────────────────────────────────────────────────────────
const registerVoter = async (req, res, next) => {
  try {
    const { fullName, rollNumber, yearOfPassing, branch, email, mobile, cityCountry, company, designation } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    // Check if already voted — no point in re-registering
    const existingVoter = await Voter.findOne({ email: normalizedEmail });
    if (existingVoter?.hasVoted) {
      return res.status(400).json({ success: false, message: 'You have already cast your vote in this election.' });
    }

    // OTP rate limit: max 5 requests per hour
    const now = new Date();
    if (existingVoter) {
      const windowStart  = existingVoter.otpRequestWindowStart || new Date(0);
      const elapsedMin   = (now - windowStart) / 60000;
      if (elapsedMin < 60 && (existingVoter.otpRequestCount || 0) >= 5) {
        return res.status(429).json({ success: false, message: 'Too many OTP requests. Please try again after 1 hour.' });
      }
      if (elapsedMin >= 60) {
        existingVoter.otpRequestCount        = 0;
        existingVoter.otpRequestWindowStart   = now;
      }
    }

    const otp    = generateOTP();
    const hashed = await hashOTP(otp);
    const expiry = getOTPExpiry(10);

    let voter;
    if (existingVoter) {
      // Update existing record with latest details
      Object.assign(existingVoter, {
        fullName, rollNumber,
        yearOfPassing: parseInt(yearOfPassing, 10),
        branch, mobile, cityCountry, company, designation,
      });
      existingVoter.otpHash             = hashed;
      existingVoter.otpExpiry           = expiry;
      existingVoter.otpAttempts         = 0;
      existingVoter.emailVerified       = false;
      existingVoter.otpRequestCount     = (existingVoter.otpRequestCount || 0) + 1;
      if (!existingVoter.otpRequestWindowStart) existingVoter.otpRequestWindowStart = now;
      existingVoter.registrationIp      = req.ip;
      voter = await existingVoter.save();
    } else {
      voter = await Voter.create({
        fullName, rollNumber,
        yearOfPassing: parseInt(yearOfPassing, 10),
        branch, email: normalizedEmail, mobile, cityCountry, company, designation,
        otpHash: hashed, otpExpiry: expiry,
        otpRequestCount: 1, otpRequestWindowStart: now,
        registrationIp: req.ip,
      });
    }

    console.log(`\n🗳️  Voter Register | ${normalizedEmail} | OTP: ${otp}\n`);
    try {
      await sendVoterOTP({ to: normalizedEmail, name: fullName, otp });
    } catch (e) {
      console.error('Voter OTP email failed:', e.message);
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Valid for 10 minutes.',
      voterId: voter._id,
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'This email is already registered as a voter.' });
    }
    next(err);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voter/verify-otp
// Verifies OTP and marks emailVerified = true
// ─────────────────────────────────────────────────────────────────────────────
const verifyVoterOTP = async (req, res, next) => {
  try {
    const { voterId, otp } = req.body;
    const voter = await Voter.findById(voterId).select('+otpHash +otpExpiry +otpAttempts');

    if (!voter)               return res.status(404).json({ success: false, message: 'Voter not found.' });
    if (voter.hasVoted)       return res.status(400).json({ success: false, message: 'You have already cast your vote.' });
    if (voter.otpAttempts >= 5) return res.status(429).json({ success: false, message: 'Too many attempts. Please register again.' });
    if (!voter.otpHash || isOTPExpired(voter.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please register again.' });
    }

    const valid = await verifyOTP(String(otp), voter.otpHash);
    if (!valid) {
      voter.otpAttempts += 1;
      await voter.save();
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${5 - voter.otpAttempts} attempt(s) remaining.`,
      });
    }

    voter.emailVerified = true;
    voter.otpHash       = undefined;
    voter.otpExpiry     = undefined;
    voter.otpAttempts   = 0;
    await voter.save();

    return res.status(200).json({
      success:  true,
      message:  'Email verified. Registration complete.',
      voterId:  voter._id,
    });

  } catch (err) { next(err); }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voter/login
// Voter enters email + roll number on voting page.
// System checks if they are registered and verified in DB.
// If details match → return voterId to access ballot.
// ─────────────────────────────────────────────────────────────────────────────
const loginVoter = async (req, res, next) => {
  try {
    const email      = (req.body.email      || '').trim().toLowerCase();
    const rollNumber = (req.body.rollNumber || '').trim();

    if (!email || !rollNumber) {
      return res.status(400).json({ success: false, message: 'Email and roll number are required.' });
    }

    // Look up voter by email
    const voter = await Voter.findOne({ email });

    // Not registered at all
    if (!voter) {
      return res.status(404).json({
        success:       false,
        notRegistered: true,
        message:       'You are not registered as a voter. Please complete voter registration first.',
      });
    }

    // Registered but email not verified
    if (!voter.emailVerified) {
      return res.status(403).json({
        success:       false,
        notRegistered: true,
        message:       'Your voter registration is not complete. Please verify your email first.',
      });
    }

    // Already voted
    if (voter.hasVoted) {
      return res.status(400).json({
        success:      false,
        alreadyVoted: true,
        message:      'You have already cast your vote in this election.',
      });
    }

    // Roll number mismatch
    if (voter.rollNumber.toLowerCase() !== rollNumber.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: 'Roll number does not match our records. Please check and try again.',
      });
    }

    // All checks passed
    return res.status(200).json({
      success:  true,
      voterId:  voter._id,
      fullName: voter.fullName,
      message:  'Identity verified. You may now vote.',
    });

  } catch (err) { next(err); }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/voter/ballot/:voterId
// Returns only admin-approved candidates, grouped by position
// ─────────────────────────────────────────────────────────────────────────────
const getBallot = async (req, res, next) => {
  try {
    const voter = await Voter.findById(req.params.voterId);
    if (!voter)                return res.status(404).json({ success: false, message: 'Voter not found.' });
    if (!voter.emailVerified)  return res.status(403).json({ success: false, message: 'Email not verified.' });
    if (voter.hasVoted)        return res.status(400).json({ success: false, message: 'You have already voted.' });

    const candidates = await Nomination.find(
      { status: 'approved' },
      {
        nominationId: 1, positions: 1,
        'candidate.fullName': 1, 'candidate.branch': 1,
        'candidate.yearOfPassing': 1, 'candidate.designation': 1, 'candidate.company': 1,
      }
    ).lean();

    const POSITIONS = ['President', 'General Secretary', 'Treasurer', 'Co-Treasurer', 'Executive Council Member'];
    const ballot = {};
    POSITIONS.forEach(p => { ballot[p] = []; });

    candidates.forEach(c => {
      (c.positions || []).forEach(pos => {
        if (ballot[pos]) {
          ballot[pos].push({
            _id:           c._id,
            nominationId:  c.nominationId,
            fullName:      c.candidate.fullName,
            branch:        c.candidate.branch,
            yearOfPassing: c.candidate.yearOfPassing,
            designation:   c.candidate.designation,
            company:       c.candidate.company,
          });
        }
      });
    });

    return res.status(200).json({ success: true, ballot });

  } catch (err) { next(err); }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voter/submit-vote
// Atomic transaction — creates vote + marks voter as hasVoted
// ─────────────────────────────────────────────────────────────────────────────
const submitVote = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { voterId, presidentId, generalSecretaryId, treasurerId, coTreasurerId, execMemberIds } = req.body;

    if (!Array.isArray(execMemberIds)) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ success: false, message: 'execMemberIds must be an array.' });
    }

    const voter = await Voter.findById(voterId).session(session);
    if (!voter)               { await session.abortTransaction(); session.endSession(); return res.status(404).json({ success: false, message: 'Voter not found.' }); }
    if (!voter.emailVerified) { await session.abortTransaction(); session.endSession(); return res.status(403).json({ success: false, message: 'Email not verified.' }); }
    if (voter.hasVoted)       { await session.abortTransaction(); session.endSession(); return res.status(400).json({ success: false, message: 'You have already voted.' }); }

    const [vote] = await Vote.create(
      [{ voterId, presidentId, generalSecretaryId, treasurerId, coTreasurerId, submittedIp: req.ip }],
      { session }
    );

    if (execMemberIds.length > 0) {
      await VoteExecMember.insertMany(
        execMemberIds.map(cid => ({ voteId: vote._id, candidateId: cid })),
        { session }
      );
    }

    voter.hasVoted = true;
    voter.votedAt  = new Date();
    voter.votingIp = req.ip;
    await voter.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, message: 'Your vote has been cast successfully. Thank you for participating!' });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'You have already voted.' });
    next(err);
  }
};


module.exports = { registerVoter, verifyVoterOTP, loginVoter, getBallot, submitVote };
