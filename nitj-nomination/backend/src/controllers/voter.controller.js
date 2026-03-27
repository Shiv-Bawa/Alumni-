const mongoose  = require('mongoose');
const Voter     = require('../models/voter.model');
const { Vote, VoteExecutiveMember } = require('../models/vote.model');
const Nomination = require('../models/nomination.model');
const { generateOTP, hashOTP, verifyOTP, getOTPExpiry, isOTPExpired } = require('../services/otp.service');
const { sendOTPEmail } = require('../services/email.service');



// register voter 
const registerVoter = async (req, res) => {
  try {
    const {
      fullName, rollNumber, yearOfPassing, branch,
      email, mobile, cityCountry, company, designation,
    } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    // checking from database
    const alumniRecord = await Nomination.findOne({
      'candidateDetails.email': normalizedEmail,
    });

    if (!alumniRecord) {
      return res.status(400).json({
        success: false,
        message:
          'You have not registered with the NITJ Alumni Association with the used email ID. ' +
          'Please register at the following link for participation in the next election: ' +
          'https://www.nitjaa.com/signup',
      });
    }

    // Check if voter already voted
    let voter = await Voter.findOne({ email: normalizedEmail });

    if (voter && voter.emailVerified && voter.hasVoted) {
      return res.status(400).json({ success: false, message: 'You have already cast your vote.' });
    }

    // OTP rate limit: max 5 per hour
    const now = new Date();
    if (voter) {
      const windowStart   = voter.otpRequestWindowStart || new Date(0);
      const windowElapsed = (now - windowStart) / 1000 / 60; // minutes
      if (windowElapsed < 60 && voter.otpRequestCount >= 5) {
        return res.status(429).json({
          success: false,
          message: 'Maximum OTP requests exceeded. Please try again after 1 hour.',
        });
      }
      if (windowElapsed >= 60) {
        voter.otpRequestCount = 0;
        voter.otpRequestWindowStart = now;
      }
    }

    const otp    = generateOTP();
    const hashed = await hashOTP(otp);
    const expiry = getOTPExpiry(10); // 10 minutes

    if (voter) {
      voter.fullName      = fullName;
      voter.rollNumber    = rollNumber;
      voter.yearOfPassing = yearOfPassing;
      voter.branch        = branch;
      voter.mobile        = mobile;
      voter.cityCountry   = cityCountry;
      voter.company       = company;
      voter.designation   = designation;
      voter.otpHash       = hashed;
      voter.otpExpiry     = expiry;
      voter.otpAttempts   = 0;
      voter.emailVerified = false;
      voter.otpRequestCount = (voter.otpRequestCount || 0) + 1;
      if (!voter.otpRequestWindowStart) voter.otpRequestWindowStart = now;
      voter.registrationIp = req.ip;
    } else {
      voter = new Voter({
        fullName, rollNumber, yearOfPassing, branch,
        email: normalizedEmail, mobile, cityCountry, company, designation,
        otpHash: hashed, otpExpiry: expiry,
        otpRequestCount: 1, otpRequestWindowStart: now,
        registrationIp: req.ip,
      });
    }

    await voter.save();

    // Send OTP email
    await sendOTPEmail(normalizedEmail, fullName, otp, 'voter');

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your registered email. Valid for 10 minutes.',
      voterId: voter._id,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `A voter with this ${field === 'rollNumber' ? 'Roll Number' : 'Email'} already exists.`,
      });
    }
    console.error('registerVoter error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};





// verifying otp
const verifyVoterOTP = async (req, res) => {
  try {
    const { voterId, otp } = req.body;

    const voter = await Voter.findById(voterId).select('+otpHash +otpExpiry +otpAttempts');
    if (!voter) return res.status(404).json({ success: false, message: 'Voter not found.' });

    if (voter.emailVerified && voter.hasVoted) {
      return res.status(400).json({ success: false, message: 'You have already cast your vote.' });
    }

    if (voter.otpAttempts >= 5) {
      return res.status(429).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (!voter.otpHash || !voter.otpExpiry) {
      return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
    }

    if (isOTPExpired(voter.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const valid = await verifyOTP(otp.toString(), voter.otpHash);
    if (!valid) {
      voter.otpAttempts += 1;
      await voter.save();
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${5 - voter.otpAttempts} attempts remaining.`,
      });
    }

    // Clear OTP and mark verified
    voter.emailVerified = true;
    voter.otpHash       = undefined;
    voter.otpExpiry     = undefined;
    voter.otpAttempts   = 0;
    await voter.save();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully.',
      voterId: voter._id,
    });
  } catch (err) {
    console.error('verifyVoterOTP error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};





// Ballot for candidates 
const getBallotCandidates = async (req, res) => {
  try {
    const { voterId } = req.params;

    const voter = await Voter.findById(voterId);
    if (!voter)             return res.status(404).json({ success: false, message: 'Voter not found.' });
    if (!voter.emailVerified) return res.status(403).json({ success: false, message: 'Email not verified.' });
    if (voter.hasVoted)     return res.status(400).json({ success: false, message: 'You have already cast your vote.' });

    const positions = ['President', 'General Secretary', 'Treasurer', 'Co-Treasurer', 'Executive Council Member'];

    const candidates = await Nomination.find(
      { positionsApplied: { $in: positions }, status: 'submitted' },
      {
        nominationId: 1,
        positionsApplied: 1,
        'candidateDetails.fullName': 1,
        'candidateDetails.branch': 1,
        'candidateDetails.yearOfPassingOut': 1,
        'candidateDetails.designation': 1,
        'candidateDetails.company': 1,
      }
    ).lean();

    // Group by position
    const ballot = {};
    positions.forEach(pos => { ballot[pos] = []; });

    candidates.forEach(c => {
      const pos = c.positionsApplied; // 🔥 FIX (now string, not array)

      if (ballot[pos]) {
        ballot[pos].push({
          _id:          c._id,
          nominationId: c.nominationId,
          fullName:     c.candidateDetails.fullName,
          branch:       c.candidateDetails.branch,
          yearOfPassing: c.candidateDetails.yearOfPassingOut,
          designation:  c.candidateDetails.designation,
          company:      c.candidateDetails.company,
        });
      }
    });

    return res.status(200).json({ success: true, ballot });
  } catch (err) {
    console.error('getBallotCandidates error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};



// submit the vote
const submitVote = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      voterId,
      presidentCandidateId,
      generalSecretaryCandidateId,
      treasurerCandidateId,
      coTreasurerCandidateId,
      executiveMemberIds,
    } = req.body;

    // Validate executive members count
    if (!Array.isArray(executiveMemberIds) || executiveMemberIds.length === 0 || executiveMemberIds.length > 8) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Select between 1 and 8 Executive Council Members.' });
    }

    const voter = await Voter.findById(voterId).session(session);
    if (!voter) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Voter not found.' });
    }

    if (!voter.emailVerified) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Email not verified.' });
    }

    if (voter.hasVoted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'You have already cast your vote.' });
    }

    const [vote] = await Vote.create(
      [{
        voterId,
        presidentCandidateId,
        generalSecretaryCandidateId,
        treasurerCandidateId,
        coTreasurerCandidateId,
        submittedIp: req.ip,
      }],
      { session }
    );

    const execDocs = executiveMemberIds.map(cid => ({ voteId: vote._id, candidateId: cid }));
    await VoteExecutiveMember.insertMany(execDocs, { session });

    voter.hasVoted = true;
    voter.votedAt  = new Date();
    voter.votingIp = req.ip;
    await voter.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: 'Your vote has been cast successfully. Thank you for participating!',
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already cast your vote.' });
    }
    console.error('submitVote error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};



// check voter status 
const getVoterStatus = async (req, res) => {
  try {
    const voter = await Voter.findById(req.params.voterId, 'emailVerified hasVoted');
    if (!voter) return res.status(404).json({ success: false, message: 'Voter not found.' });
    return res.status(200).json({ success: true, emailVerified: voter.emailVerified, hasVoted: voter.hasVoted });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { registerVoter, verifyVoterOTP, getBallotCandidates, submitVote, getVoterStatus };