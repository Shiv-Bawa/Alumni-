const fs = require('fs');
const Nomination = require('../models/nomination.model');
const {
  generateOTP,
  hashOTP,
  verifyOTP,
  getOTPExpiry,
  isOTPExpired
} = require('../services/otp.service');

const {
  sendOTPEmail,
  sendConfirmationEmail
} = require('../services/email.service');


/*
Flow:
User submits form                     ->
Data stored with status = pending_otp ->
OTP generated + hashed + saved        ->
User enters OTP                       ->
OTP verified                          ->
Status changed to submitted           ->
Confirmation email sent
*/


// Helper – clean up uploaded files if anything fails
const deleteUploadedFiles = (files = {}) => {
  Object.values(files).flat().forEach((f) => fs.unlink(f.path, () => {}));
};


// POST /api/nomination/submit
const submitNomination = async (req, res, next) => {
  try {
    const files = req.files || {};

    // 🔹 Required file checks
    if (!files.paymentScreenshot?.[0])
      return res.status(400).json({ success: false, message: 'Payment screenshot is required.' });

    if (!files.proofOfAssociation?.[0])
      return res.status(400).json({ success: false, message: 'Proof of association is required.' });

    const body = req.body;

    // 🔥 FIX 1: Handle position (ONLY ONE allowed)
    let positionsApplied = req.body.positionsApplied;

    // ❌ If array comes (Postman or hack)
    if (Array.isArray(positionsApplied)) {
      deleteUploadedFiles(files);
      return res.status(400).json({
        success: false,
        message: "Only one position can be selected"
      });
    }

    // ❌ Validate single value
    if (!positionsApplied || typeof positionsApplied !== "string") {
      deleteUploadedFiles(files);
      return res.status(400).json({
        success: false,
        message: "Select a valid position"
      });
    }

    // Clean value
    positionsApplied = positionsApplied.trim();

    // 🔥 FIX 2: Correct email extraction
    const candidateEmail = body.email?.trim().toLowerCase();

    // 🔥 FIX 3: Prevent duplicate per position
    const existing = await Nomination.findOne({
      'candidateDetails.email': candidateEmail,
      status: 'submitted',
      positionsApplied: positionsApplied
    });

    if (existing) {
      deleteUploadedFiles(files);
      return res.status(409).json({
        success: false,
        message: "You have already applied for this position."
      });
    }

    // 🔹 Remove stale pending nominations (older than 30 mins)
    await Nomination.deleteOne({
      'candidateDetails.email': candidateEmail,
      status: 'pending_otp',
      createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
    });

    // 🔹 Generate & hash OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // 🔹 Create nomination
    const nomination = await Nomination.create({
      positionsApplied,
      candidateDetails: {
        fullName: body.fullName,
        email: candidateEmail,
        mobile: body.mobile
      },
      status: 'pending_otp',
      otpHash,
      otpExpiry: getOTPExpiry(),
    });

    console.log("Saved nomination:", nomination);

    // 🔹 Send OTP email
    try {
      await sendOTPEmail({
        to: candidateEmail,
        candidateName: nomination.candidateDetails.fullName,
        otp,
        nominationId: nomination.nominationId,
      });

      console.log("Generated OTP:", otp);
    } catch (emailErr) {
      console.error('OTP email failed:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: `OTP sent to ${candidateEmail}. Please verify to complete your nomination.`,
      nominationId: nomination.nominationId,
    });

  } catch (err) {
    deleteUploadedFiles(req.files);
    next(err);
  }
};


// POST /api/nomination/verify-otp
const verifyOTPAndConfirm = async (req, res, next) => {
  try {
    const { nominationId, otp } = req.body;

    const nomination = await Nomination
      .findOne({ nominationId })
      .select('+otpHash +otpExpiry +otpAttempts');

    if (!nomination)
      return res.status(404).json({ success: false, message: 'Nomination not found.' });

    if (nomination.status === 'submitted')
      return res.status(400).json({ success: false, message: 'Nomination is already verified.' });

    if (nomination.otpAttempts >= 5)
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please resubmit your form.' });

    if (isOTPExpired(nomination.otpExpiry))
      return res.status(400).json({ success: false, message: 'OTP has expired. Please resubmit to get a new OTP.' });

    const isValid = await verifyOTP(otp, nomination.otpHash);

    if (!isValid) {
      nomination.otpAttempts += 1;
      await nomination.save();

      const remaining = 5 - nomination.otpAttempts;

      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
      });
    }

    // 🔹 Mark as submitted
    nomination.isEmailVerified = true;
    nomination.status = 'submitted';
    nomination.submittedAt = new Date();
    nomination.otpHash = undefined;
    nomination.otpExpiry = undefined;
    nomination.otpAttempts = undefined;

    await nomination.save();

    // 🔹 Send confirmation email
    sendConfirmationEmail({
      to: nomination.candidateDetails.email,
      candidateName: nomination.candidateDetails.fullName,
      nominationId: nomination.nominationId,
      positions: nomination.positionsApplied,
    }).catch((e) => console.error('Confirmation email failed:', e.message));

    res.status(200).json({
      success: true,
      message: 'Nomination verified and submitted successfully!',
      nominationId: nomination.nominationId,
    });

  } catch (err) {
    next(err);
  }
};


// POST /api/nomination/resend-otp
const resendOTP = async (req, res, next) => {
  try {
    const { nominationId } = req.body;

    const nomination = await Nomination
      .findOne({ nominationId, status: 'pending_otp' })
      .select('+otpHash +otpExpiry +otpAttempts');

    if (!nomination)
      return res.status(404).json({ success: false, message: 'Pending nomination not found.' });

    const otp = generateOTP();

    nomination.otpHash = await hashOTP(otp);
    nomination.otpExpiry = getOTPExpiry();
    nomination.otpAttempts = 0;

    await nomination.save();

    await sendOTPEmail({
      to: nomination.candidateDetails.email,
      candidateName: nomination.candidateDetails.fullName,
      otp,
      nominationId: nomination.nominationId,
    });

    res.status(200).json({
      success: true,
      message: 'New OTP sent to your email.'
    });

  } catch (err) {
    next(err);
  }
};


module.exports = {
  submitNomination,
  verifyOTPAndConfirm,
  resendOTP
};