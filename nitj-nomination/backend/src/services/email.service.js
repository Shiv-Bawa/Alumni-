const nodemailer = require('nodemailer');

let _transporter;
const getTransporter = () => {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth:   { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return _transporter;
};


// layout 
const layout = (body) => `
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Georgia,serif;background:#f4f1ee;color:#1a1a1a}
  .wrap{max-width:580px;margin:36px auto;background:#fff;border-radius:4px;overflow:hidden;
        box-shadow:0 2px 16px rgba(0,0,0,.10)}
  .hd{background:#800000;padding:28px 36px;display:flex;align-items:center;gap:16px}
  .hd-logo{width:48px;height:48px;border:2px solid rgba(255,255,255,.5);border-radius:50%;
           display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
           color:#fff;line-height:1.2;text-align:center;flex-shrink:0}
  .hd-text{color:#fff}.hd-text h1{font-size:16px;font-weight:700;margin-bottom:2px}
  .hd-text p{font-size:12px;opacity:.8}
  .bd{padding:32px 36px}
  .bd p{font-size:15px;line-height:1.7;color:#333;margin-bottom:14px}
  .otp-box{background:#f9f0f0;border:2px dashed #800000;border-radius:6px;text-align:center;
            padding:24px;margin:24px 0}
  .otp-code{font-size:44px;font-weight:700;color:#800000;letter-spacing:12px;
             font-family:'Courier New',monospace}
  .otp-note{font-size:12px;color:#888;margin-top:8px}
  .meta{background:#fafafa;border-radius:4px;padding:16px 20px;margin:20px 0;font-size:14px}
  .meta b{color:#800000}
  .warn{border-left:3px solid #e65100;background:#fff8f5;padding:12px 16px;
        font-size:13px;color:#bf360c;border-radius:0 4px 4px 0;margin:20px 0}
  .success-badge{background:#e8f5e9;border:1px solid #c8e6c9;color:#2e7d32;padding:16px 20px;
                  border-radius:4px;text-align:center;font-size:16px;font-weight:700;margin:20px 0}
  .ft{background:#5c0000;padding:18px 36px;text-align:center;font-size:12px;color:rgba(255,255,255,.7)}
</style></head><body>
<div class="wrap">
  <div class="hd">
    <div class="hd-logo">NIT<br>J</div>
    <div class="hd-text">
      <h1>NIT Jalandhar Alumni Association</h1>
      <p>Alumni Election 2024–25</p>
    </div>
  </div>
  <div class="bd">${body}</div>
  <div class="ft">National Institute of Technology, Jalandhar – 144011, Punjab, India</div>
</div>
</body></html>`;



// otp 
const sendOTPEmail = async (toOrObj, nameArg, otpArg, contextArg) => {
  let to, candidateName, otp, nominationId, context;
  if (typeof toOrObj === 'object' && toOrObj !== null) {
    ({ to, candidateName, otp, nominationId } = toOrObj);
    context = 'nomination';
  } else {
    to = toOrObj; candidateName = nameArg; otp = otpArg; context = contextArg || 'nomination';
  }
  const expMin  = context === 'voter' ? 10 : (process.env.OTP_EXPIRY_MINUTES || 5);
  const subject = context === 'voter'
    ? 'OTP Verification – NITJ Alumni Voter Registration'
    : `[${nominationId}] OTP Verification – NITJ Alumni Election Nomination`;
  const intro = context === 'voter'
    ? 'Use the OTP below to verify your email and access the Voter Portal.'
    : 'Thank you for submitting your nomination. Use the OTP below to verify your email.';
  const metaLine = context === 'voter'
    ? `<div><b>Email:</b> ${to}</div>`
    : `<div><b>Nomination ID:</b> ${nominationId}</div><div style="margin-top:6px"><b>Email:</b> ${to}</div>`;

  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM || '"NITJ Elections" <noreply@nitj.ac.in>',
    to,
    subject,
    html: layout(`
      <p>Dear <strong>${candidateName}</strong>,</p>
      <p>${intro}</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-note">Valid for <strong>${expMin} minutes</strong> only · Do not share this OTP</div>
      </div>
      <div class="meta">${metaLine}</div>
      <div class="warn">⚠️ If you did not initiate this request, please ignore this email.</div>
    `),
  });
};



// confirmation
const sendConfirmationEmail = async ({ to, candidateName, nominationId, positions }) => {
  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM || '"NITJ Elections" <noreply@nitj.ac.in>',
    to,
    subject: `Nomination Confirmed – ${nominationId} | NITJ Alumni Election`,
    html: layout(`
      <div class="success-badge">✅ Nomination Successfully Submitted!</div>
      <p>Dear <strong>${candidateName}</strong>,</p>
      <p>Your nomination has been verified and recorded by the Election Committee.</p>
      <div class="meta">
        <div><b>Nomination ID:</b> ${nominationId}</div>
        <div style="margin-top:6px"><b>Position(s):</b> ${positions}</div>
      </div>
      <p>The Election Committee will review your documents and reach out if anything is required.
         Results will be declared as per the election schedule.</p>
      <p>Best of luck! 🎓</p>
      <p><em>NITJ Alumni Election Committee</em></p>
    `),
  });
};



module.exports = { sendOTPEmail,
  sendConfirmationEmail 
  };
