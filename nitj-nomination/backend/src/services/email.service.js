const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/* ── Nomination OTP ─────────────────────────────────────────────────────────── */
const sendNominationOTP = async ({ to, name, otp, nominationId }) => {
  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `[NITJAA Election] Your Nomination OTP — ${otp}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #ddd;border-radius:10px;overflow:hidden">
        <div style="background:#7b0000;padding:24px;text-align:center">
          <h2 style="color:#fff;margin:0">NITJAA Election Portal</h2>
          <p style="color:rgba(255,255,255,.8);margin:6px 0 0">NIT Jalandhar Alumni Association</p>
        </div>
        <div style="padding:32px">
          <p style="font-size:16px">Dear <strong>${name}</strong>,</p>
          <p>Your nomination OTP is:</p>
          <div style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#7b0000;text-align:center;padding:20px 0">${otp}</div>
          <p style="color:#555;font-size:13px">This OTP is valid for <strong>10 minutes</strong>.<br>
          Nomination Reference: <strong>${nominationId}</strong></p>
          <p style="color:#999;font-size:12px">If you did not submit a nomination, please ignore this email.</p>
        </div>
      </div>`,
  });
};

/* ── Nomination Confirmation ─────────────────────────────────────────────────── */
const sendNominationConfirmation = async ({ to, name, nominationId, positions }) => {
  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `[NITJAA Election] Nomination Submitted — ${nominationId}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #ddd;border-radius:10px;overflow:hidden">
        <div style="background:#7b0000;padding:24px;text-align:center">
          <h2 style="color:#fff;margin:0">Nomination Confirmed</h2>
        </div>
        <div style="padding:32px">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your nomination has been successfully submitted and is pending admin review.</p>
          <p><strong>Nomination ID:</strong> ${nominationId}<br>
             <strong>Position(s):</strong> ${Array.isArray(positions) ? positions.join(', ') : positions}</p>
          <p style="color:#555;font-size:13px">You will be notified once the admin reviews your application.</p>
        </div>
      </div>`,
  });
};

/* ── Voter OTP ───────────────────────────────────────────────────────────────── */
const sendVoterOTP = async ({ to, name, otp }) => {
  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `[NITJAA Election] Your Voting OTP — ${otp}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #ddd;border-radius:10px;overflow:hidden">
        <div style="background:#1a3a6b;padding:24px;text-align:center">
          <h2 style="color:#fff;margin:0">NITJAA Voting Portal</h2>
        </div>
        <div style="padding:32px">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your voting access OTP is:</p>
          <div style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#1a3a6b;text-align:center;padding:20px 0">${otp}</div>
          <p style="color:#555;font-size:13px">Valid for <strong>10 minutes</strong>. Use this to access the voting ballot.</p>
          <p style="color:#999;font-size:12px">If you did not request this, please ignore.</p>
        </div>
      </div>`,
  });
};

/* ── Admin Notification ──────────────────────────────────────────────────────── */
const sendAdminNominationAlert = async ({ nominationId, candidateName, positions }) => {
  if (!process.env.SMTP_USER) return;
  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.SMTP_USER,
    subject: `[NITJAA] New Nomination — ${candidateName}`,
    html: `<p>New nomination received.</p>
           <p><strong>ID:</strong> ${nominationId}<br>
           <strong>Candidate:</strong> ${candidateName}<br>
           <strong>Position(s):</strong> ${Array.isArray(positions) ? positions.join(', ') : positions}</p>
           <p>Login to the admin dashboard to review.</p>`,
  });
};

module.exports = {
  sendNominationOTP,
  sendNominationConfirmation,
  sendVoterOTP,
  sendAdminNominationAlert,
};
