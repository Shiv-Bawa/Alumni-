const mongoose  = require('mongoose');
const Voter     = require('../models/voter.model');
const { Vote, VoteExecutiveMember } = require('../models/vote.model');
const Nomination = require('../models/nomination.model');
const { generateOTP, hashOTP, verifyOTP, getOTPExpiry, isOTPExpired } = require('../services/otp.service');
const { sendOTPEmail } = require('../services/email.service');

// 1. Register Voter & Request OTP
const registerVoter = async (req, res) => {
  try {
    const { fullName, rollNumber, email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    let voter = await Voter.findOne({ 
      email: normalizedEmail,
      rollNumber: rollNumber.trim() 
    });

    if (!voter) {
      return res.status(400).json({
        success: false,
        message: 'You have not registered with the NITJ Alumni Association with the used email ID. Please register at: https://www.nitjaa.com/signup',
      });
    }

    if (voter.hasVoted) {
      return res.status(400).json({ success: false, message: 'You have already cast your vote.' });
    }

    const now = new Date();
    const windowStart = voter.otpRequestWindowStart || new Date(0);
    const windowElapsed = (now - windowStart) / 1000 / 60; 
    
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

    const otp = generateOTP();
    const hashed = await hashOTP(otp);
    const expiry = getOTPExpiry(10); 

    voter.otpHash = hashed;
    voter.otpExpiry = expiry;
    voter.otpAttempts = 0;
    voter.emailVerified = false;
    voter.otpRequestCount = (voter.otpRequestCount || 0) + 1;
    voter.registrationIp = req.ip;

    await voter.save();
    console.log(`\n[DEV ONLY] OTP for ${normalizedEmail} is: ${otp}\n`);

    await sendOTPEmail(normalizedEmail, voter.fullName, otp, 'voter');

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your registered email. Valid for 10 minutes.',
      voterId: voter._id,
    });

  } catch (err) {
    console.error('registerVoter error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// 2. Verify OTP
const verifyVoterOTP = async (req, res) => {
  try {
    const { voterId, otp } = req.body;
    const voter = await Voter.findById(voterId).select('+otpHash +otpExpiry +otpAttempts');

    if (!voter) return res.status(404).json({ success: false, message: 'Voter not found.' });
    if (voter.hasVoted) return res.status(400).json({ success: false, message: 'Already voted.' });

    if (isOTPExpired(voter.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP expired.' });
    }

    const valid = await verifyOTP(otp.toString(), voter.otpHash);
    if (!valid) {
      voter.otpAttempts += 1;
      await voter.save();
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    }

    voter.emailVerified = true;
    voter.otpHash = undefined;
    voter.otpExpiry = undefined;
    await voter.save();

    return res.status(200).json({ success: true, message: 'Verified.', voterId: voter._id });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// 3. Get Ballot
const getBallotCandidates = async (req, res) => {
  try {
    const { voterId } = req.params;
    const voter = await Voter.findById(voterId);

    if (!voter || !voter.emailVerified || voter.hasVoted) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const positions = ['President', 'General Secretary', 'Treasurer', 'Co-Treasurer', 'Executive Council Member'];

    const candidates = await Nomination.find(
      { status: 'submitted', isAdminVerified: true },
      {
        nominationId: 1,
        positionsApplied: 1,
        'candidateDetails.fullName': 1,
        'candidateDetails.branch': 1,
        'candidateDetails.yearOfPassingOut': 1,
      }
    ).lean();

    const ballot = {};
    positions.forEach(pos => { ballot[pos] = []; });

    candidates.forEach(c => {
      const posArray = Array.isArray(c.positionsApplied) ? c.positionsApplied : [c.positionsApplied];
      posArray.forEach(pos => {
        if (ballot[pos]) {
          ballot[pos].push({
            _id: c._id,
            fullName: c.candidateDetails.fullName,
            branch: c.candidateDetails.branch,
            yearOfPassing: c.candidateDetails.yearOfPassingOut,
          });
        }
      });
    });

    return res.status(200).json({ success: true, ballot });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error loading ballot.' });
  }
};

// 4. Submit the Vote
const submitVote = async (req, res) => {
  try {
    const { 
      voterId, 
      presidentCandidateId, 
      generalSecretaryCandidateId, 
      treasurerCandidateId, 
      coTreasurerCandidateId, 
      executiveMemberIds 
    } = req.body;

    const voter = await Voter.findById(voterId);
    if (!voter || voter.hasVoted) {
      return res.status(400).json({ success: false, message: 'Voter ineligible or already voted.' });
    }

    const vote = await Vote.create({
        voterId,
        presidentCandidateId: presidentCandidateId || null,
        generalSecretaryCandidateId: generalSecretaryCandidateId || null,
        treasurerCandidateId: treasurerCandidateId || null,
        coTreasurerCandidateId: coTreasurerCandidateId || null,
        submittedIp: req.ip,
    });

    if (executiveMemberIds && executiveMemberIds.length > 0) {
      const execDocs = executiveMemberIds.map(cid => ({ voteId: vote._id, candidateId: cid }));
      await VoteExecutiveMember.insertMany(execDocs);
    }

    const allIds = [
      presidentCandidateId, 
      generalSecretaryCandidateId, 
      treasurerCandidateId, 
      coTreasurerCandidateId, 
      ...(executiveMemberIds || [])
    ].filter(id => id && mongoose.Types.ObjectId.isValid(id));
    
    await Nomination.updateMany({ _id: { $in: allIds } }, { $inc: { votes: 1 } });

    // 🔥 FIXED: Direct update to ensure MongoDB saves 'true' immediately
    await Voter.findByIdAndUpdate(voterId, {
      $set: {
        hasVoted: true,
        votedAt: new Date(),
        votingIp: req.ip
      }
    });

    console.log(`>>> Success: Voter ${voterId} marked as hasVoted: true in DB.`);

    return res.status(200).json({ success: true, message: 'Your vote has been cast successfully!' });

  } catch (err) {
    console.error('Vote Submission Error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error during voting.' });
  }
};

// 5. Check Voter Status
const getVoterStatus = async (req, res) => {
  try {
    const voter = await Voter.findById(req.params.voterId);
    if (!voter) {
      return res.status(404).json({ success: false, message: 'Voter not found.' });
    }
    return res.json({ 
      success: true, 
      emailVerified: voter.emailVerified, 
      hasVoted: voter.hasVoted 
    });
  } catch (err) { 
    console.error('getVoterStatus error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' }); 
  }
};

module.exports = { 
  registerVoter, 
  verifyVoterOTP, 
  getBallotCandidates, 
  submitVote, 
  getVoterStatus 
};