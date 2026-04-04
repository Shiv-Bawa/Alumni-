'use strict';

const API = 'http://localhost:5000/api/nomination';
let nominationId  = null;
let timerInterval = null;

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const el   = id => document.getElementById(id);
const show = e  => { if (e) e.style.display = ''; };
const hide = e  => { if (e) e.style.display = 'none'; };

function toast(msg, type = '') {
  const t = el('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 4500);
}

function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  const lbl  = btn.querySelector('.btn-label');
  const spin = btn.querySelector('.btn-spin');
  if (lbl)  lbl.style.display  = on ? 'none' : '';
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
  show(a);
}

/* ── Validation (NO proposer fields) ────────────────────────────────────────── */
function validate() {
  let ok       = true;
  let firstErr = null;

  function fail(fieldId, msg) {
    setErr(fieldId, msg);
    if (!firstErr) firstErr = el(fieldId) || el('err-' + fieldId);
    ok = false;
  }

  /* 1. At least one position selected */
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

  /* 2. Candidate text fields */
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
  const cEmail = el('candidateEmail')?.value?.trim();
  if (cEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail)) {
    fail('candidateEmail', 'Enter a valid email address.');
  }

  /* 4. Mobile format */
  const cMobile = el('candidateMobile')?.value?.trim();
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

/* ── Build FormData (NO proposer fields) ─────────────────────────────────────── */
function buildFormData() {
  const fd = new FormData();

  /* Positions — one or multiple */
  document.querySelectorAll('input[name="positions"]:checked').forEach(cb => {
    fd.append('positions', cb.value);
  });

  /* Candidate details — flat keys (multer requires flat for multipart) */
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
  fd.append('paymentScreenshot', el('paymentScreenshot').files[0]);
  fd.append('candidateProof',    el('candidateProof').files[0]);

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
    const res    = await fetch(`${API}/submit`, { method: 'POST', body: buildFormData() });
    const result = await res.json();
    console.log('📥 Server response:', result);

    if (result.success) {
      nominationId = result.nominationId;
      el('otpEmailDisplay').textContent = el('candidateEmail').value.trim();
      ['d0','d1','d2','d3'].forEach(id => { const c = el(id); if (c) c.value = ''; });
      hide(el('otpAlert'));
      show(el('otpModal'));
      document.body.style.overflow = 'hidden';
      el('d0')?.focus();
      startTimer(600);
      el('step1').classList.remove('active'); el('step1').classList.add('done');
      el('step2').classList.add('active');
    } else {
      toast(result.message || 'Submission failed. Please try again.', 'bad');
    }
  } catch (err) {
    console.error('Network error:', err);
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
      hide(el('otpModal'));
      document.body.style.overflow = '';
      el('successNomId').textContent = nominationId;
      show(el('successOverlay'));
      el('step2').classList.remove('active'); el('step2').classList.add('done');
      el('step3').classList.add('active');
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
      hide(el('otpAlert'));
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

  /* Wire upload zones */
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

  /* OTP cell navigation */
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

  /* Close modal on backdrop click */
  const modal = el('otpModal');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        hide(modal);
        document.body.style.overflow = '';
        clearInterval(timerInterval);
      }
    });
  }

  console.log('✔ nomination.js loaded');
});
