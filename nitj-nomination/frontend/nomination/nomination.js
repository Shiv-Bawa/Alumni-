'use strict';

const API = 'http://localhost:5000/api/nomination';
let nominationId  = null;
let timerInterval = null;

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const el = id => document.getElementById(id);

/* IMPORTANT: Use explicit display values — never rely on '' which depends on CSS */
const show      = e => { if (e) e.style.display = 'flex';   }; // for modal-bg (flex layout)
const showBlock = e => { if (e) e.style.display = 'block';  }; // for overlays, alerts
const hide      = e => { if (e) e.style.display = 'none';   };

function toast(msg, type = '') {
  const t = el('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 5000);
}

function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  const lbl  = btn.querySelector('.btn-label');
  const spin = btn.querySelector('.btn-spin');
  if (lbl)  lbl.style.display = on ? 'none' : '';
  if (spin) spin.style.display = on ? '' : 'none';
}

function setErr(id, msg) {
  const errEl = el('err-' + id);
  if (errEl) errEl.textContent = msg || '';
  const inp = el(id);
  if (inp) inp.classList.toggle('err', !!msg);
}
const clearErr = id => setErr(id, '');

function showOTPAlert(msg) {
  const a = el('otpAlert');
  if (!a) return;
  a.textContent = msg;
  a.style.display = 'block';
}

/* ── Validation ──────────────────────────────────────────────────────────────── */
function validate() {
  let ok       = true;
  let firstErr = null;

  function fail(fieldId, msg) {
    setErr(fieldId, msg);
    if (!firstErr) firstErr = el(fieldId) || el('err-' + fieldId);
    ok = false;
  }

  /* 1. At least one position */
  const positions = [...document.querySelectorAll('input[name="positions"]:checked')];
  if (!positions.length) {
    const posErr = el('err-positions');
    if (posErr) posErr.textContent = 'Select at least one position.';
    if (!firstErr) firstErr = el('sec-positions');
    ok = false;
  } else {
    const posErr = el('err-positions');
    if (posErr) posErr.textContent = '';
  }

  /* 2. Candidate text / select fields */
  [
    ['candidateFullName',    'Full name is required'],
    ['candidateRollNumber',  'Roll number is required'],
    ['candidateYear',        'Year of passing is required'],
    ['candidateBranch',      'Branch is required'],
    ['candidateEmail',       'Email is required'],
    ['candidateMobile',      'Mobile number is required'],
    ['candidateCityCountry', 'City & Country is required'],
    ['candidateCompany',     'Company is required'],
    ['candidateDesignation', 'Designation is required'],
    ['transactionNumber',    'Transaction number is required'],
  ].forEach(([id, msg]) => {
    const v = (el(id)?.value || '').trim();
    if (!v) fail(id, msg); else clearErr(id);
  });

  /* 3. Email format */
  const cEmail = (el('candidateEmail')?.value || '').trim();
  if (cEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail)) {
    fail('candidateEmail', 'Enter a valid email address.');
  }

  /* 4. Mobile format */
  const cMobile = (el('candidateMobile')?.value || '').trim();
  if (cMobile && !/^[6-9]\d{9}$/.test(cMobile)) {
    fail('candidateMobile', 'Enter a valid 10-digit Indian mobile number.');
  }

  /* 5. File uploads */
  [
    ['paymentScreenshot', 'Payment screenshot is required'],
    ['candidateProof',    'Proof of association is required'],
  ].forEach(([id, msg]) => {
    if (!el(id)?.files?.[0]) fail(id, msg); else clearErr(id);
  });

  /* 6. Declaration */
  if (!el('declarationAccepted')?.checked) {
    fail('declaration', 'You must accept the declaration.');
  } else {
    clearErr('declaration');
  }

  if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return ok;
}

/* ── Build FormData ───────────────────────────────────────────────────────────── */
/*
  multer parses multipart/form-data fields as FLAT literal strings.
  Always use simple flat names here — never bracket notation.
*/
function buildFormData() {
  const fd = new FormData();

  /* Positions — append each checked position */
  document.querySelectorAll('input[name="positions"]:checked').forEach(cb => {
    fd.append('positions', cb.value);
  });

  /* Candidate details — flat keys */
  fd.append('candidateFullName',    el('candidateFullName').value.trim());
  fd.append('candidateRollNumber',  el('candidateRollNumber').value.trim());
  fd.append('candidateYear',        el('candidateYear').value.trim());
  fd.append('candidateBranch',      el('candidateBranch').value.trim());
  fd.append('candidateEmail',       el('candidateEmail').value.trim());
  fd.append('candidateMobile',      el('candidateMobile').value.trim());
  fd.append('candidateCityCountry', el('candidateCityCountry').value.trim());
  fd.append('candidateCompany',     el('candidateCompany').value.trim());
  fd.append('candidateDesignation', el('candidateDesignation').value.trim());

  /* Payment */
  fd.append('transactionNumber', el('transactionNumber').value.trim());

  /* Declaration */
  fd.append('declarationAccepted', el('declarationAccepted').checked ? 'true' : 'false');

  /* Files */
  const payFile   = el('paymentScreenshot')?.files[0];
  const proofFile = el('candidateProof')?.files[0];
  if (payFile)   fd.append('paymentScreenshot', payFile);
  if (proofFile) fd.append('candidateProof',    proofFile);

  return fd;
}

/* ── Submit ──────────────────────────────────────────────────────────────────── */
window.submitNomination = async function () {
  console.log('▶ submitNomination called');

  if (!validate()) {
    console.log('✖ Validation failed — check red fields');
    return;
  }

  const btn = el('submitBtn');
  setLoading(btn, true);

  try {
    console.log('📤 Sending to server...');

    const res = await fetch(`${API}/submit`, {
      method: 'POST',
      body:   buildFormData(),
      /* Do NOT set Content-Type — browser sets multipart/form-data with boundary automatically */
    });

    console.log('📥 HTTP status:', res.status);

    let result;
    try {
      result = await res.json();
    } catch (parseErr) {
      console.error('Could not parse server response:', parseErr);
      toast('Server error. Please try again.', 'bad');
      return;
    }

    console.log('📥 Server response:', result);

    if (result.success) {
      nominationId = result.nominationId;
      console.log('✔ Nomination created:', nominationId);

      /* Update email display in modal */
      const emailDisp = el('otpEmailDisplay');
      if (emailDisp) emailDisp.textContent = el('candidateEmail').value.trim();

      /* Clear OTP cells */
      ['d0','d1','d2','d3'].forEach(id => { const c = el(id); if (c) c.value = ''; });

      /* Hide any previous OTP alert */
      const alertEl = el('otpAlert');
      if (alertEl) alertEl.style.display = 'none';

      /* ── OPEN MODAL ──────────────────────────────────────────────────────── */
      /* Use display:flex explicitly — never '' which depends on CSS cascade    */
      const modal = el('otpModal');
      if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        console.log('✔ Modal opened');
      } else {
        console.error('❌ otpModal element not found!');
      }

      /* Focus first OTP digit after modal renders */
      setTimeout(() => el('d0')?.focus(), 150);

      /* Start countdown */
      startTimer(600);

      /* Advance stepper */
      const s1 = el('step1'), s2 = el('step2');
      if (s1) { s1.classList.remove('active'); s1.classList.add('done'); }
      if (s2) s2.classList.add('active');

      toast('OTP sent! Check your email.', 'ok');

    } else {
      console.error('✖ Server rejected:', result);
      toast(result.message || 'Submission failed. Please try again.', 'bad');
      /* Show field-level errors if any */
      if (result.errors && typeof result.errors === 'object') {
        Object.entries(result.errors).forEach(([field, msg]) => setErr(field, msg));
      }
    }

  } catch (networkErr) {
    console.error('🔥 Network error:', networkErr);
    toast('Cannot reach server. Is the backend running on port 5000?', 'bad');
  } finally {
    setLoading(btn, false);
  }
};

/* ── Verify OTP ──────────────────────────────────────────────────────────────── */
window.verifyOTP = async function () {
  const code = ['d0','d1','d2','d3'].map(id => el(id)?.value || '').join('');
  if (code.length < 4) { showOTPAlert('Please enter all 4 digits.'); return; }

  const btn = el('verifyBtn');
  setLoading(btn, true);
  hide(el('otpAlert'));

  try {
    const res  = await fetch(`${API}/verify-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nominationId, otp: code }),
    });
    const data = await res.json();

    if (data.success) {
      clearInterval(timerInterval);

      /* Close OTP modal */
      const modal = el('otpModal');
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = '';

      /* Show success overlay */
      const sid = el('successNomId');
      if (sid) sid.textContent = nominationId;
      const overlay = el('successOverlay');
      if (overlay) overlay.style.display = 'flex';

      /* Update stepper */
      const s2 = el('step2'), s3 = el('step3');
      if (s2) { s2.classList.remove('active'); s2.classList.add('done'); }
      if (s3) s3.classList.add('active');

      console.log('✔ Nomination verified:', nominationId);

    } else {
      showOTPAlert(data.message || 'Incorrect OTP.');
    }
  } catch {
    showOTPAlert('Verification failed. Check your connection.');
  } finally {
    setLoading(btn, false);
  }
};

/* ── Resend OTP ──────────────────────────────────────────────────────────────── */
window.resendOTP = async function () {
  const btn = el('resendBtn');
  if (btn) btn.disabled = true;
  try {
    const res  = await fetch(`${API}/resend-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nominationId }),
    });
    const data = await res.json();
    if (data.success) {
      ['d0','d1','d2','d3'].forEach(id => { const c = el(id); if (c) c.value = ''; });
      const alertEl = el('otpAlert');
      if (alertEl) alertEl.style.display = 'none';
      el('d0')?.focus();
      startTimer(600);
      toast('New OTP sent! Check your email.', 'ok');
    } else {
      toast(data.message || 'Resend failed.', 'bad');
      if (btn) btn.disabled = false;
    }
  } catch {
    toast('Resend failed. Check your connection.', 'bad');
    if (btn) btn.disabled = false;
  }
};

/* ── Timer ───────────────────────────────────────────────────────────────────── */
function startTimer(seconds) {
  clearInterval(timerInterval);
  let rem = seconds;
  const resendBtn = el('resendBtn');
  if (resendBtn) resendBtn.disabled = true;

  const update = () => {
    const m = Math.floor(rem / 60), s = rem % 60;
    const disp = el('otpTimer');
    if (disp) disp.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    if (rem <= 0) {
      clearInterval(timerInterval);
      if (disp) disp.textContent = 'Expired';
      if (resendBtn) resendBtn.disabled = false;
    }
    rem--;
  };
  update();
  timerInterval = setInterval(update, 1000);
}

/* ── DOM Ready ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* Upload zones — click to open file picker, show filename on select */
  document.querySelectorAll('.upload-zone').forEach(zone => {
    const input = zone.querySelector('.upload-input');
    if (!input) return;
    const zoneId = zone.id.replace('zone-', '');
    const sel    = zone.querySelector('.upload-sel');

    zone.addEventListener('click', e => { if (e.target !== input) input.click(); });
    input.addEventListener('change', () => {
      if (input.files[0]) {
        if (sel) sel.textContent = '✓ ' + input.files[0].name;
        zone.classList.add('has-file');
        const errEl = el('err-' + zoneId);
        if (errEl) errEl.textContent = '';
      }
    });
  });

  /* OTP cell auto-advance, backspace, paste */
  const cells = ['d0','d1','d2','d3'].map(id => el(id));
  cells.forEach((cell, i) => {
    if (!cell) return;
    cell.addEventListener('input', () => {
      cell.value = cell.value.replace(/\D/g, '').slice(0, 1);
      if (cell.value && i < 3) cells[i + 1]?.focus();
    });
    cell.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !cell.value && i > 0) cells[i - 1]?.focus();
    });
    cell.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 4);
      [...pasted].forEach((ch, j) => { if (cells[j]) cells[j].value = ch; });
      cells[Math.min(pasted.length, 3)]?.focus();
    });
  });

  /* Wire verify and resend buttons */
  const vBtn = el('verifyBtn');
  if (vBtn) vBtn.addEventListener('click', window.verifyOTP);

  const rBtn = el('resendBtn');
  if (rBtn) rBtn.addEventListener('click', window.resendOTP);

  /* Close modal on backdrop click */
  const modal = el('otpModal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        clearInterval(timerInterval);
      }
    });
  }

  console.log('✔ nomination.js loaded');
});