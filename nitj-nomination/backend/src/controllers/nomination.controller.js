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

    /* ── Required file checks ───────────────────────────────────────────────── */
    if (!files.paymentScreenshot?.[0])
      return res.status(400).json({ success: false, message: 'Payment screenshot is required.' });

    if (!files.candidateProof?.[0])
      return res.status(400).json({ success: false, message: 'Proof of association is required.' });

    /* ── Positions ──────────────────────────────────────────────────────────── */
    let positions = b.positions;
    if (!positions)
      return res.status(400).json({ success: false, message: 'At least one position is required.' });
    if (typeof positions === 'string') positions = [positions];
    positions = [...new Set(positions.map(p => p.trim()))];

    /* ── Candidate email ────────────────────────────────────────────────────── */
    const candidateEmail = (b.candidateEmail || '').trim().toLowerCase();
    if (!candidateEmail) {
      cleanFiles(files);
      return res.status(400).json({ success: false, message: 'Candidate email is required.' });
    }

    /* ── Duplicate check ────────────────────────────────────────────────────── */
    const exists = await Nomination.findOne({
      'candidate.email': candidateEmail,
      status: { $in: ['pending_admin', 'approved', 'rejected'] },
    });
    if (exists) {
      cleanFiles(files);
      return res.status(409).json({ success: false, message: 'A nomination from this email already exists.' });
    }

    /* ── Remove stale pending_otp (older than 30 min) ───────────────────────── */
    await Nomination.deleteOne({
      'candidate.email': candidateEmail,
      status: 'pending_otp',
      createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
    });

    /* ── Generate OTP ───────────────────────────────────────────────────────── */
    const otp     = generateOTP();
    const otpHash = await hashOTP(otp);

    /* ── Save nomination ────────────────────────────────────────────────────── */
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

    /* ── Send OTP email ─────────────────────────────────────────────────────── */
    try {
      await sendNominationOTP({
        to:           candidateEmail,
        name:         nomination.candidate.fullName,
        otp,
        nominationId: nomination.nominationId,
      });
    } catch (e) {
      console.error('OTP email failed:', e.message);
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
      return res.status(400).json({ success: false, message: 'Nomination already verified.' });
    if (nom.otpAttempts >= 5)
      return res.status(429).json({ success: false, message: 'Too many attempts. Please resubmit the form.' });
    if (isOTPExpired(nom.otpExpiry))
      return res.status(400).json({ success: false, message: 'OTP has expired. Please resubmit.' });

    const valid = await verifyOTP(String(otp), nom.otpHash);
    if (!valid) {
      nom.otpAttempts += 1;
      await nom.save();
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${5 - nom.otpAttempts} attempt(s) remaining.`,
      });
    }

    nom.status      = 'pending_admin';
    nom.submittedAt = new Date();
    nom.otpHash     = undefined;
    nom.otpExpiry   = undefined;
    nom.otpAttempts = 0;
    await nom.save();

    /* Non-blocking emails */
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
      message:      'Email verified! Your nomination is submitted and pending admin review.',
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
      return res.status(404).json({ success: false, message: 'Pending nomination not found.' });

    const otp         = generateOTP();
    nom.otpHash       = await hashOTP(otp);
    nom.otpExpiry     = getOTPExpiry(10);
    nom.otpAttempts   = 0;
    await nom.save();

    await sendNominationOTP({
      to:           nom.candidate.email,
      name:         nom.candidate.fullName,
      otp,
      nominationId: nom.nominationId,
    });

    return res.status(200).json({ success: true, message: 'New OTP sent.' });
  } catch (err) { next(err); }
};


module.exports = { submitNomination, verifyNominationOTP, resendNominationOTP };
