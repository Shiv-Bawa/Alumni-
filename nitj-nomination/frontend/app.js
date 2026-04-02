'use strict';

const API_BASE = 'http://localhost:5000/api/nomination';
const OTP_SEC  = 600;

let nominationId   = null;
let timerInterval  = null;
let timerRemaining = OTP_SEC;

/* ── tiny helpers ─────────────────────────────────────────────────────────── */
const el   = (id) => document.getElementById(id);
const show = (e)  => { if (e) e.style.display = ''; };
const hide = (e)  => { if (e) e.style.display = 'none'; };

const setLoading = (btn, on) => {
  if (!btn) return;
  btn.disabled = on;
  const lbl  = btn.querySelector('.btn-label');
  const spin = btn.querySelector('.btn-spin');
  const arr  = btn.querySelector('.btn-arrow');
  if (lbl)  lbl.style.display  = on ? 'none' : '';
  if (spin) spin.style.display = on ? ''     : 'none';
  if (arr)  arr.style.display  = on ? 'none' : '';
};

const setErr   = (id, msg) => {
  const errEl = el(`err-${id}`);
  if (errEl) errEl.textContent = msg || '';
  const inp = el(id);
  if (inp) inp.classList.toggle('err', !!msg);
};
const clearErr = (id) => setErr(id, '');

const toast = (msg, type = '') => {
  const t = el('toast');
  if (!t) return;
  t.textContent = msg;
  // CSS classes in this project are 'ok' and 'bad', not 'success'/'err'
  t.className   = `toast show${type === 'err' ? ' bad' : type === 'ok' ? ' ok' : ''}`;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 4500);
};

/* ── validation ───────────────────────────────────────────────────────────── */
const TEXT_FIELDS = [
  ['c_fullName',    'Full name is required'],
  ['c_rollNumber',  'Roll number is required'],
  ['c_year',        'Year of passing is required'],
  ['c_branch',      'Branch is required'],
  ['c_email',       'Email is required'],
  ['c_mobile',      'Mobile number is required'],
  ['c_city',        'Current city is required'],
  ['c_country',     'Current country is required'],
  ['c_company',     'Company is required'],
  ['c_designation', 'Designation is required'],
  ['txnNumber',     'Transaction number is required'],
];

const FILE_FIELDS = [
  ['paymentScreenshot',  'Payment screenshot is required'],
  ['proofOfAssociation', 'Proof of association document is required'],
];

function validateAll() {
  let ok            = true;
  let firstErrorEl  = null;   // track first broken field to scroll to it

  const markError = (el, msg, errId) => {
    setErr(errId || el?.id, msg);
    if (!firstErrorEl && el) firstErrorEl = el;
    ok = false;
  };

  /* position */
  const picked = document.querySelectorAll('input[name="positionsApplied"]:checked');
  if (!picked.length) {
    const posEl = el('err-positions');
    markError(el('sec-positions'), 'Select at least one position.', 'positions');
  } else {
    clearErr('positions');
  }

  /* text / select fields */
  TEXT_FIELDS.forEach(([id, msg]) => {
    const inp = el(id);
    if (!inp) return;
    if (!(inp.value || '').trim()) {
      markError(inp, msg, id);
    } else {
      clearErr(id);
    }
  });

  /* file fields */
  FILE_FIELDS.forEach(([id, msg]) => {
    const inp = el(id);
    if (!inp || !inp.files || !inp.files[0]) {
      markError(el(`zone-${id}`) || inp, msg, id);
    } else {
      clearErr(id);
    }
  });

  /* declaration */
  const decl = el('declarationAccepted');
  if (!decl || !decl.checked) {
    markError(decl, 'You must accept the declaration.', 'declaration');
  } else {
    clearErr('declaration');
  }

  /* scroll to first error so user sees what's wrong */
  if (firstErrorEl) {
    firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return ok;
}

/* ── buildFormData ─────────────────────────────────────────────────────────
   IMPORTANT: This is a multipart/form-data request (because it includes files).
   multer parses multipart fields as FLAT literal strings.
   "candidateDetails[fullName]" becomes the literal key req.body["candidateDetails[fullName]"]
   — NOT req.body.candidateDetails.fullName.
   Only express.urlencoded (qs) does bracket→nested parsing, and only for non-file forms.
   So we MUST use simple flat field names here.
──────────────────────────────────────────────────────────────────────────── */
function buildFormData() {
  const fd = new FormData();

  /* position — single string */
  const picked = document.querySelector('input[name="positionsApplied"]:checked');
  if (picked) fd.append('positionsApplied', picked.value);

  /* candidate details — FLAT keys */
  fd.append('fullName',         el('c_fullName').value.trim());
  fd.append('rollNumber',       el('c_rollNumber').value.trim());
  fd.append('yearOfPassingOut', el('c_year').value.trim());
  fd.append('branch',           el('c_branch').value.trim());
  fd.append('email',            el('c_email').value.trim());
  fd.append('mobile',           el('c_mobile').value.trim());
  fd.append('currentCity',      el('c_city').value.trim());
  fd.append('currentCountry',   el('c_country').value.trim());
  fd.append('company',          el('c_company').value.trim());
  fd.append('designation',      el('c_designation').value.trim());

  /* payment — FLAT key */
  fd.append('transactionNumber', el('txnNumber').value.trim());

  /* files */
  const payFile   = el('paymentScreenshot').files[0];
  const proofFile = el('proofOfAssociation').files[0];
  if (payFile)   fd.append('paymentScreenshot',  payFile);
  if (proofFile) fd.append('proofOfAssociation', proofFile);

  /* declaration — string "true" */
  fd.append('declarationAccepted', el('declarationAccepted').checked ? 'true' : 'false');

  return fd;
}

/* ── form submit ──────────────────────────────────────────────────────────── */
async function onFormSubmit(e){
  if (e && e.preventDefault) e.preventDefault();

  console.log('▶ onFormSubmit called');

  if (!validateAll()) {
    console.log('✖ Client validation failed — see red fields above');
    return false;
  }

  const btn = el('submitBtn');
  setLoading(btn, true);

  try {
    console.log('📤 Sending to server…');
    const response = await fetch(`${API_BASE}/submit`, {
      method: 'POST',
      body:   buildFormData(),
      // ⚠ Do NOT set Content-Type — the browser sets multipart/form-data with boundary
    });

    const result = await response.json();
    console.log('📥 Server response:', result);

    if (result.success) {
      nominationId = result.nominationId;
      console.log('✔ Success — opening OTP modal');

      /* reset OTP cells */
      ['d0', 'd1', 'd2', 'd3'].forEach(id => { const c = el(id); if (c) c.value = ''; });

      /* hide any previous alert inside modal */
      const alertEl = el('otpAlert');
      if (alertEl) hide(alertEl);

      /* show modal */
      show(el('otpModal'));
      document.body.style.overflow = 'hidden';
      el('d0')?.focus();

      startTimer();
      toast('OTP sent! Check your email inbox.', 'ok');

    } else {
      /* show the server's error message prominently */
      console.error('✖ Server rejected submission:', result);
      toast(result.message || 'Submission failed. Please try again.', 'err');

      /* if server returned field-level errors, show them too */
      if (result.errors) {
        Object.entries(result.errors).forEach(([field, msg]) => {
          setErr(field, msg);
        });
      }
    }

  } catch (networkErr) {
    console.error('🔥 Network error:', networkErr);
    toast('Cannot reach server. Is the backend running on port 5000?', 'err');
  } finally {
    setLoading(btn, false);
  }

  return false;
};

/* ── OTP verify ───────────────────────────────────────────────────────────── */
window.onVerifyOTP = async function () {
  const code = ['d0', 'd1', 'd2', 'd3'].map(id => el(id)?.value || '').join('');

  if (code.length < 4) {
    showOTPAlert('Please enter all 4 digits.');
    return;
  }

  const btn = el('verifyBtn');
  setLoading(btn, true);

  try {
    const res  = await fetch(`${API_BASE}/verify-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nominationId, otp: code }),
    });
    const data = await res.json();

    if (data.success) {
      clearInterval(timerInterval);
      hide(el('otpModal'));
      document.body.style.overflow = '';

      const sid = el('successId');
      if (sid) sid.textContent = nominationId;
      show(el('successOverlay'));

    } else {
      showOTPAlert(data.message || 'Incorrect OTP. Please try again.');
    }

  } catch (err) {
    showOTPAlert('Verification failed. Check your connection.');
  } finally {
    setLoading(btn, false);
  }
};

/* ── OTP resend ───────────────────────────────────────────────────────────── */
window.onResendOTP = async function () {
  if (!nominationId) return;
  const btn = el('resendBtn');
  if (btn) btn.disabled = true;

  try {
    const res  = await fetch(`${API_BASE}/resend-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nominationId }),
    });
    const data = await res.json();

    if (data.success) {
      ['d0', 'd1', 'd2', 'd3'].forEach(id => { const c = el(id); if (c) c.value = ''; });
      el('d0')?.focus();
      hide(el('otpAlert'));
      startTimer();
      toast('New OTP sent! Check your email.', 'ok');
    } else {
      toast(data.message || 'Resend failed.', 'err');
      if (btn) btn.disabled = false;
    }

  } catch (err) {
    toast('Resend failed. Check your connection.', 'err');
    if (btn) btn.disabled = false;
  }
};

/* ── timer ────────────────────────────────────────────────────────────────── */
function startTimer() {
  timerRemaining = OTP_SEC;
  clearInterval(timerInterval);

  const resendBtn = el('resendBtn');
  if (resendBtn) resendBtn.disabled = true;

  timerInterval = setInterval(() => {
    timerRemaining--;
    const min  = Math.floor(timerRemaining / 60);
    const sec  = timerRemaining % 60;
    const disp = el('otpTimer');
    if (disp) disp.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;

    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      if (disp) disp.textContent = 'Expired';
      if (resendBtn) resendBtn.disabled = false;
    }
  }, 1000);
}

function showOTPAlert(msg) {
  const a = el('otpAlert');
  if (!a) return;
  a.textContent = msg;
  show(a);
}

/* ── DOM ready ────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* ✅ ADD THIS BLOCK (IMPORTANT FIX) */
  const form = el('submitBtn');
  if (form) {
    form.addEventListener('click', onFormSubmit);
  }

  /* upload zones */
  ['paymentScreenshot', 'proofOfAssociation'].forEach(id => {
    const zone  = el(`zone-${id}`);
    const input = el(id);
    const sel   = el(`sel-${id}`);
    if (!zone || !input) return;

    zone.onclick = (e) => {
      if (e.target !== input) input.click();
    };

    input.onchange = () => {
      if (input.files[0]) {
        if (sel) sel.textContent = '✓ ' + input.files[0].name;
        clearErr(id);
      }
    };
  });

  /* OTP cells */
  const cells = ['d0', 'd1', 'd2', 'd3'].map(id => el(id));
  cells.forEach((cell, idx) => {
    if (!cell) return;

    cell.oninput = () => {
      cell.value = cell.value.replace(/\D/g, '').slice(0, 1);
      if (cell.value && idx < 3) cells[idx + 1].focus();
    };

    cell.onkeydown = (e) => {
      if (e.key === 'Backspace' && !cell.value && idx > 0) cells[idx - 1].focus();
    };

    cell.onpaste = (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData('text').replace(/\D/g, '').slice(0, 4);
      [...pasted].forEach((ch, j) => { if (cells[j]) cells[j].value = ch; });
      cells[Math.min(pasted.length, 3)]?.focus();
    };
  });

  /* buttons */
  const vBtn = el('verifyBtn');
  if (vBtn) vBtn.onclick = window.onVerifyOTP;

  const rBtn = el('resendBtn');
  if (rBtn) rBtn.onclick = window.onResendOTP;

  /* modal close */
  const modal = el('otpModal');
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        hide(modal);
        document.body.style.overflow = '';
        clearInterval(timerInterval);
      }
    };
  }

  console.log('✔ app.js loaded — ready');
});