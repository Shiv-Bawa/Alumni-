'use strict';

const API = 'http://localhost:5000/api/nomination';
let nominationId  = null;
let timerInterval = null;

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const el = id => document.getElementById(id);

const hide = e => { if (e) e.style.display = 'none'; };

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
  a.textContent    = msg;
  a.style.display  = 'block';
}

/* ── Open OTP Modal ───────────────────────────────────────────────────────────── */
function openModal() {
  /* Clear digits */
  ['d0','d1','d2','d3'].forEach(id => { const c = el(id); if (c) c.value = ''; });

  /* Hide alert */
  const alertEl = el('otpAlert');
  if (alertEl) alertEl.style.display = 'none';

  /* Set email display */
  const emailDisp = el('otpEmailDisplay');
  if (emailDisp) emailDisp.textContent = el('candidateEmail').value.trim();

  /* Show modal — explicit flex, never rely on '' */
  const modal = el('otpModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    console.log('✔ OTP modal is now visible');
  } else {
    console.error('❌ Could not find #otpModal in the DOM');
    alert('OTP sent to your email! The modal failed to open — please refresh the page and try again.');
    return;
  }

  /* Focus first digit box after a short delay */
  setTimeout(() => el('d0')?.focus(), 200);

  /* Start countdown */
  startTimer(600);

  /* Advance stepper */
  const s1 = el('step1'), s2 = el('step2');
  if (s1) { s1.classList.remove('active'); s1.classList.add('done'); }
  if (s2) { s2.classList.remove('done');   s2.classList.add('active'); }
}

/* ── Validate ────────────────────────────────────────────────────────────────── */
function validate() {
  let ok       = true;
  let firstErr = null;

  function fail(fieldId, msg) {
    setErr(fieldId, msg);
    if (!firstErr) firstErr = el(fieldId) || el('err-' + fieldId);
    ok = false;
  }

  /* Positions */
  const positions = [...document.querySelectorAll('input[name="positions"]:checked')];
  if (!positions.length) {
    const pe = el('err-positions');
    if (pe) pe.textContent = 'Select at least one position.';
    if (!firstErr) firstErr = el('sec-positions');
    ok = false;
  } else {
    const pe = el('err-positions');
    if (pe) pe.textContent = '';
  }

  /* Text / select fields */
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

  /* Email format */
  const cEmail = (el('candidateEmail')?.value || '').trim();
  if (cEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail))
    fail('candidateEmail', 'Enter a valid email address.');

  /* Mobile format */
  const cMobile = (el('candidateMobile')?.value || '').trim();
  if (cMobile && !/^[6-9]\d{9}$/.test(cMobile))
    fail('candidateMobile', 'Enter a valid 10-digit Indian mobile number.');

  /* Files */
  [
    ['paymentScreenshot', 'Payment screenshot is required'],
    ['candidateProof',    'Proof of association is required'],
  ].forEach(([id, msg]) => {
    if (!el(id)?.files?.[0]) fail(id, msg); else clearErr(id);
  });

  /* Declaration */
  if (!el('declarationAccepted')?.checked)
    fail('declaration', 'You must accept the declaration.');
  else clearErr('declaration');

  if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return ok;
}

/* ── Build FormData ──────────────────────────────────────────────────────────── */
function buildFormData() {
  const fd = new FormData();

  document.querySelectorAll('input[name="positions"]:checked')
    .forEach(cb => fd.append('positions', cb.value));

  fd.append('candidateFullName',    el('candidateFullName').value.trim());
  fd.append('candidateRollNumber',  el('candidateRollNumber').value.trim());
  fd.append('candidateYear',        el('candidateYear').value.trim());
  fd.append('candidateBranch',      el('candidateBranch').value.trim());
  fd.append('candidateEmail',       el('candidateEmail').value.trim());
  fd.append('candidateMobile',      el('candidateMobile').value.trim());
  fd.append('candidateCityCountry', el('candidateCityCountry').value.trim());
  fd.append('candidateCompany',     el('candidateCompany').value.trim());
  fd.append('candidateDesignation', el('candidateDesignation').value.trim());
  fd.append('transactionNumber',    el('transactionNumber').value.trim());
  fd.append('declarationAccepted',  el('declarationAccepted').checked ? 'true' : 'false');

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
    console.log('✖ Validation failed');
    return;
  }

  const btn = el('submitBtn');
  setLoading(btn, true);

  try {
    console.log('📤 Sending to server...');

    const res = await fetch(`${API}/submit`, {
      method: 'POST',
      body:   buildFormData(),
    });

    console.log('📥 HTTP status:', res.status);

    let result;
    try {
      result = await res.json();
    } catch {
      toast('Server returned an unexpected response. Please try again.', 'bad');
      return;
    }

    console.log('📥 Server result:', result);

    if (result.success) {
      /* ── Happy path: new nomination created ── */
      nominationId = result.nominationId;
      console.log('✔ nominationId:', nominationId);
      openModal();
      toast('OTP sent! Check your email.', 'ok');

    } else {
      toast(result.message || 'Submission failed.', 'bad');
    }

  } catch (networkErr) {
    console.error('🔥 Network error:', networkErr);
    toast('Cannot reach the server. Make sure the backend is running on port 5000.', 'bad');
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
  const alertEl = el('otpAlert');
  if (alertEl) alertEl.style.display = 'none';

  try {
    const res  = await fetch(`${API}/verify-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nominationId, otp: code }),
    });
    const data = await res.json();

    if (data.success) {
      clearInterval(timerInterval);

      /* Close modal */
      const modal = el('otpModal');
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = '';

      /* Show success overlay */
      const sid = el('successNomId');
      if (sid) sid.textContent = nominationId;
      const overlay = el('successOverlay');
      if (overlay) overlay.style.display = 'flex';

      /* Stepper */
      const s2 = el('step2'), s3 = el('step3');
      if (s2) { s2.classList.remove('active'); s2.classList.add('done'); }
      if (s3) s3.classList.add('active');

      console.log('✔ Nomination verified!');

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

  /* Upload zones */
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

  /* OTP cells */
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

  /* Verify / Resend buttons */
  el('verifyBtn')?.addEventListener('click', window.verifyOTP);
  el('resendBtn')?.addEventListener('click', window.resendOTP);

  /* Backdrop click closes modal */
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

  console.log('✔ nomination.js loaded — ready');
});
