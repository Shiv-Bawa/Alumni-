'use strict';

//  NOMINATION FORM 

const API_BASE = 'http://localhost:5000/api/nomination';
const MAX_MB   = 5;
const OTP_SEC  = 300; // 5 minutes

// sate 
let nominationId   = null;
let timerInterval  = null;
let timerRemaining = OTP_SEC;

const el    = (id)  => document.getElementById(id);
const show  = (e)  => { e.style.display = ''; };
const hide  = (e)  => { e.style.display = 'none'; };
const setErr = (id, msg) => {
  const errEl = el(`err-${id}`);
  if (errEl) errEl.textContent = msg || '';
  const inp = el(id);
  if (inp) inp.classList.toggle('err', !!msg);
};
const clearErr = (id) => setErr(id, '');

// Toast
const toast = (msg, type = '') => {
  const t = el('toast');
  t.textContent  = msg;
  t.className    = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 3500);
};

// Spinner
const setLoading = (btn, on) => {
  btn.disabled = on;
  const lbl  = btn.querySelector('.btn-label');
  const spin = btn.querySelector('.btn-spin');
  const arr  = btn.querySelector('.btn-arrow');
  if (lbl)  lbl.style.display  = on ? 'none' : '';
  if (spin) spin.style.display = on ? '' : 'none';
  if (arr)  arr.style.display  = on ? 'none' : '';
};

// progress bar 
const updateProgress = () => {
  const inputs = Array.from(document.querySelectorAll('.field-input'));
  const filled = inputs.filter(i => i.value.trim()).length;
  const pct    = Math.round((filled / inputs.length) * 90);
  el('progressFill').style.width = pct + '%';
};

// file upload area 
function initUploadZone(fieldId) {
  const zone  = el(`zone-${fieldId}`);
  const input = el(fieldId);
  const selEl = el(`sel-${fieldId}`);
  if (!zone || !input) return;

  zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('dragging'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragging');
    if (e.dataTransfer.files[0]) applyFile(fieldId, e.dataTransfer.files[0]);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) applyFile(fieldId, input.files[0]);
  });
}

function applyFile(fieldId, file) {
  const zone  = el(`zone-${fieldId}`);
  const selEl = el(`sel-${fieldId}`);
  const errEl = el(`err-${fieldId}`);

  const ext     = file.name.split('.').pop().toLowerCase();
  const okExts  = ['jpg','jpeg','png','pdf'];
  const okMimes = ['image/jpeg','image/jpg','image/png','application/pdf'];

  if (!okExts.includes(ext) || !okMimes.includes(file.type)) {
    errEl.textContent = 'Invalid file. Only PDF, JPG, PNG allowed.';
    zone.classList.remove('uploaded');
    return;
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    errEl.textContent = `File too large. Max ${MAX_MB} MB allowed.`;
    zone.classList.remove('uploaded');
    return;
  }

  errEl.textContent   = '';
  zone.classList.add('uploaded');
  selEl.textContent   = `✓ ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
}

// validation part 
const TEXT_FIELDS = [
  ['c_fullName', 'Full name is required'],
  ['c_rollNumber', 'Roll number is required'],
  ['c_year', 'Year of passing is required'],
  ['c_branch', 'Branch is required'],
  ['c_email', 'Valid email is required'],
  ['c_mobile', 'Valid 10-digit mobile is required'],
  ['c_city', 'Current city is required'],
  ['c_country', 'Current country is required'],
  ['c_company', 'Company / Occupation is required'],
  ['c_designation', 'Designation is required'],
  ['txnNumber', 'Transaction number is required'],
];

const FILE_FIELDS = [
  ['paymentScreenshot', 'Payment screenshot is required'],
  ['proofOfAssociation', 'Proof of association is required'],
];

function validateAll() {
  let ok = true;

  const picked = document.querySelectorAll('input[name="positionsApplied"]:checked');
  if (!picked.length) { setErr('positions', 'Select at least one position.'); ok = false; }
  else clearErr('positions');

  TEXT_FIELDS.forEach(([id, msg]) => {
    const inp = el(id);
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) { setErr(id, msg); ok = false; return; }

    if (id === 'c_email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setErr(id, 'Enter a valid email.'); ok = false; return;
    }
    if (id === 'c_mobile' && !/^[6-9]\d{9}$/.test(val)) {
      setErr(id, 'Enter a valid 10-digit mobile number.'); ok = false; return;
    }
    if (id === 'c_year') {
      const y = parseInt(val, 10);
      if (isNaN(y) || y < 1960 || y > new Date().getFullYear() + 5) {
        setErr(id, 'Enter a valid year.'); ok = false; return;
      }
    }
    clearErr(id);
  });

  FILE_FIELDS.forEach(([id, msg]) => {
    const inp = el(id);
    if (!inp || !inp.files || !inp.files[0]) { setErr(id, msg); ok = false; }
    else clearErr(id);
  });

  if (!el('declarationAccepted').checked) {
    setErr('declaration', 'You must accept the declaration.'); ok = false;
  } else clearErr('declaration');

  return ok;
}

// ✅ UPDATED FUNCTION (ONLY CHANGE HERE)
function buildFormData() {
  const fd = new FormData();

  const positions = Array.from(document.querySelectorAll('input[name="positionsApplied"]:checked')).map(c => c.value);

  // FIX: append each position separately
  positions.forEach(pos => {
    fd.append('positionsApplied', pos);
  });

  document.querySelectorAll('[name]:not([name="positionsApplied"])').forEach(inp => {
    if (inp.type === 'file') {
      if (inp.files[0]) fd.append(inp.name, inp.files[0]);
    } else if (inp.type === 'checkbox') {
      fd.append(inp.name, inp.checked ? 'true' : 'false');
    } else {
      fd.append(inp.name, inp.value.trim());
    }
  });

  return fd;
}

// (REST OF FILE EXACT SAME — NO CHANGE)

document.addEventListener('DOMContentLoaded', () => {
  el('nominationForm').addEventListener('submit', onFormSubmit);

  initUploadZone('paymentScreenshot');
  initUploadZone('proofOfAssociation');

  initOTPCells();
  initLiveValidation();

  el('verifyBtn').addEventListener('click', onVerifyOTP);
  el('resendBtn').addEventListener('click', onResendOTP);

  el('otpModal').addEventListener('click', (e) => {
    if (e.target === el('otpModal')) closeOTPModal();
  });

  document.querySelectorAll('.upload-input').forEach(inp => {
    inp.addEventListener('change', updateProgress);
  });

  updateProgress();
});