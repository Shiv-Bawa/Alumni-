const fs         = require('fs');
const Nomination = require('../models/nomination.model');
const { generateOTP, hashOTP, verifyOTP, getOTPExpiry, isOTPExpired } = require('../services/otp.service');
const { sendNominationOTP, sendNominationConfirmation, sendAdminNominationAlert } = require('../services/email.service');

const cleanFiles = (files = {}) =>
  Object.values(files).flat().forEach(f => fs.unlink(f.path, () => {}));


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/nomination/submit
// ─────────────────────────────────────────────────────────────────────────────
const submitNomination = async (req, res, next) => {
  try {
    const b     = req.body;
    const files = req.files || {};

    /* Required files */
    if (!files.paymentScreenshot?.[0])
      return res.status(400).json({ success: false, message: 'Payment screenshot is required.' });
    if (!files.candidateProof?.[0])
      return res.status(400).json({ success: false, message: 'Proof of association is required.' });

    /* Positions */
    let positions = b.positions;
    if (!positions) {
      cleanFiles(files);
      return res.status(400).json({ success: false, message: 'At least one position is required.' });
    }
    if (typeof positions === 'string') positions = [positions];
    positions = [...new Set(positions.map(p => p.trim()))];

    /* Candidate email */
    const candidateEmail = (b.candidateEmail || '').trim().toLowerCase();
    if (!candidateEmail) {
      cleanFiles(files);
      return res.status(400).json({ success: false, message: 'Candidate email is required.' });
    }

    /* ── KEY FIX: If a pending_otp nomination exists for this email,
       delete it and re-create (fresh OTP). This handles the case where
       the client timed out and the user is trying again. ─────────────────── */
    await Nomination.deleteOne({
      'candidate.email': candidateEmail,
      status: 'pending_otp',
    });

    /* ── If already submitted/approved/rejected, return nominationId so
       the client can still show the OTP modal for verification ────────────── */
    const existing = await Nomination.findOne({
      'candidate.email': candidateEmail,
      status: { $in: ['pending_admin', 'approved', 'rejected'] },
    });
    if (existing) {
      cleanFiles(files);
      return res.status(409).json({
        success: false,
        alreadyExists: true,
        message: 'A verified nomination from this email already exists. It has been sent to admin for review.',
      });
    }

    /* Generate OTP */
    const otp     = generateOTP();
    const otpHash = await hashOTP(otp);

    /* Save nomination */
    const nomination = await Nomination.create({
      positions,
      candidate: {
        fullName:      (b.candidateFullName    || '').trim(),
        rollNumber:    (b.candidateRollNumber  || '').trim(),
        yearOfPassing: parseInt(b.candidateYear, 10) || undefined,
        branch:        (b.candidateBranch      || '').trim(),
        email:         candidateEmail,
        mobile:        (b.candidateMobile      || '').trim(),
        cityCountry:   (b.candidateCityCountry || '').trim(),
        company:       (b.candidateCompany     || '').trim(),
        designation:   (b.candidateDesignation || '').trim(),
      },
      transactionNumber:     (b.transactionNumber || '').trim(),
      paymentScreenshotPath: files.paymentScreenshot[0].path,
      candidateProofPath:    files.candidateProof[0].path,
      declarationAccepted:
        b.declarationAccepted === 'true' || b.declarationAccepted === true,
      otpHash,
      otpExpiry: getOTPExpiry(10),
      status:    'pending_otp',
    });

    console.log(`\n📋 Nomination ${nomination.nominationId} | ${candidateEmail} | OTP: ${otp}\n`);

    /* Send OTP email */
    try {
      await sendNominationOTP({
        to:           candidateEmail,
        name:         nomination.candidate.fullName,
        otp,
        nominationId: nomination.nominationId,
      });
    } catch (e) {
      console.error('OTP email failed (check SMTP config):', e.message);
      /* Don't block the response — OTP is printed in console above for testing */
    }

    return res.status(201).json({
      success:      true,
      message:      `OTP sent to ${candidateEmail}. Valid for 10 minutes.`,
      nominationId: nomination.nominationId,
    });

  } catch (err) {
    cleanFiles(req.files);
    next(err);
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/nomination/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
const verifyNominationOTP = async (req, res, next) => {
  try {
    const { nominationId, otp } = req.body;

    const nom = await Nomination.findOne({ nominationId })
      .select('+otpHash +otpExpiry +otpAttempts');

    if (!nom)
      return res.status(404).json({ success: false, message: 'Nomination not found.' });
    if (nom.status !== 'pending_otp')
      return res.status(400).json({ success: false, message: 'Nomination already verified and submitted.' });
    if (nom.otpAttempts >= 5)
      return res.status(429).json({ success: false, message: 'Too many wrong attempts. Please resubmit the form.' });
    if (isOTPExpired(nom.otpExpiry))
      return res.status(400).json({ success: false, message: 'OTP has expired. Please resubmit the form.' });

    const valid = await verifyOTP(String(otp), nom.otpHash);
    if (!valid) {
      nom.otpAttempts += 1;
      await nom.save();
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${5 - nom.otpAttempts} attempt(s) remaining.`,
      });
    }

    /* Mark as submitted — move to admin review queue */
    nom.status      = 'pending_admin';
    nom.submittedAt = new Date();
    nom.otpHash     = undefined;
    nom.otpExpiry   = undefined;
    nom.otpAttempts = 0;
    await nom.save();

    /* Send confirmation emails (non-blocking) */
    sendNominationConfirmation({
      to:           nom.candidate.email,
      name:         nom.candidate.fullName,
      nominationId: nom.nominationId,
      positions:    nom.positions,
    }).catch(e => console.error('Confirmation email:', e.message));

    sendAdminNominationAlert({
      nominationId:  nom.nominationId,
      candidateName: nom.candidate.fullName,
      positions:     nom.positions,
    }).catch(e => console.error('Admin alert:', e.message));

    return res.status(200).json({
      success:      true,
      message:      'Email verified! Your nomination has been submitted for admin review.',
      nominationId: nom.nominationId,
    });

  } catch (err) { next(err); }
};


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/nomination/resend-otp
// ─────────────────────────────────────────────────────────────────────────────
const resendNominationOTP = async (req, res, next) => {
  try {
    const { nominationId } = req.body;

    const nom = await Nomination.findOne({ nominationId, status: 'pending_otp' })
      .select('+otpHash +otpExpiry +otpAttempts');

    if (!nom)
      return res.status(404).json({ success: false, message: 'Pending nomination not found. Please resubmit the form.' });

    const otp         = generateOTP();
    nom.otpHash       = await hashOTP(otp);
    nom.otpExpiry     = getOTPExpiry(10);
    nom.otpAttempts   = 0;
    await nom.save();

    console.log(`\n🔁 Resend OTP | ${nom.nominationId} | OTP: ${otp}\n`);

    await sendNominationOTP({
      to:           nom.candidate.email,
      name:         nom.candidate.fullName,
      otp,
      nominationId: nom.nominationId,
    });

    return res.status(200).json({ success: true, message: 'New OTP sent to your email.' });
  } catch (err) { next(err); }
};


module.exports = { submitNomination, verifyNominationOTP, resendNominationOTP };
