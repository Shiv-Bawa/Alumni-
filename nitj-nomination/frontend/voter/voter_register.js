'use strict';

const API = 'http://localhost:5000/api/voter';
let voterId      = null;
let voterEmail   = '';
let timerInterval= null;

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
  btn.querySelector('.btn-label').style.display = on ? 'none' : '';
  btn.querySelector('.btn-spin').style.display  = on ? '' : 'none';
}

function setErr(id, msg) {
  const errEl = el('err-' + id);
  if (errEl) errEl.textContent = msg || '';
  const inp = el(id);
  if (inp) inp.classList.toggle('err', !!msg);
}
const clearErr = id => setErr(id, '');

function activateStep(n) {
  for (let i = 1; i <= 3; i++) {
    const s = el(`stp${i}`);
    if (!s) continue;
    s.classList.remove('active', 'done');
    if (i < n)  s.classList.add('done');
    if (i === n) s.classList.add('active');
  }
}

function showPanel(name) {
  ['form', 'otp', 'done'].forEach(p => {
    const panel = el(`panel-${p}`);
    if (panel) panel.classList.remove('active');
  });
  const target = el(`panel-${name}`);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Validation ──────────────────────────────────────────────────────────────── */
function validate() {
  let ok = true;
  let firstErr = null;

  function fail(id, msg) {
    setErr(id, msg);
    if (!firstErr) firstErr = el(id) || el('err-' + id);
    ok = false;
  }

  const fields = [
    ['fullName',      'Full name is required'],
    ['rollNumber',    'Roll number is required'],
    ['yearOfPassing', 'Year of passing is required'],
    ['branch',        'Branch is required'],
    ['email',         'Email is required'],
    ['mobile',        'Mobile number is required'],
    ['cityCountry',   'City & Country is required'],
    ['company',       'Company is required'],
    ['designation',   'Designation is required'],
  ];

  fields.forEach(([id, msg]) => {
    const v = (el(id)?.value || '').trim();
    if (!v) fail(id, msg); else clearErr(id);
  });

  const emailVal = el('email')?.value?.trim();
  if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    fail('email', 'Enter a valid email address.');
  }

  const mobileVal = el('mobile')?.value?.trim();
  if (mobileVal && !/^[6-9]\d{9}$/.test(mobileVal)) {
    fail('mobile', 'Enter a valid 10-digit Indian mobile number.');
  }

  if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return ok;
}

/* ── Register voter ──────────────────────────────────────────────────────────── */
window.registerVoter = async function () {
  if (!validate()) return;

  const btn = el('registerBtn');
  setLoading(btn, true);
  hide(el('formAlert'));

  const payload = {
    fullName:      el('fullName').value.trim(),
    rollNumber:    el('rollNumber').value.trim(),
    yearOfPassing: el('yearOfPassing').value.trim(),
    branch:        el('branch').value.trim(),
    email:         el('email').value.trim().toLowerCase(),
    mobile:        el('mobile').value.trim(),
    cityCountry:   el('cityCountry').value.trim(),
    company:       el('company').value.trim(),
    designation:   el('designation').value.trim(),
  };

  try {
    const res  = await fetch(`${API}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      voterId    = data.voterId;
      voterEmail = payload.email;
      el('otpEmailShow').textContent = voterEmail;
      ['v0','v1','v2','v3'].forEach(id => { const c = el(id); if (c) c.value = ''; });
      hide(el('otpAlert'));
      showPanel('otp');
      activateStep(2);
      startTimer(600);
    } else {
      const alertEl = el('formAlert');
      alertEl.textContent = data.message || 'Registration failed.';
      show(alertEl);
    }
  } catch {
    const alertEl = el('formAlert');
    alertEl.textContent = 'Cannot reach server. Is the backend running on port 5000?';
    show(alertEl);
  } finally {
    setLoading(btn, false);
  }
};

/* ── Verify OTP ──────────────────────────────────────────────────────────────── */
window.verifyOTP = async function () {
  const code = ['v0','v1','v2','v3'].map(id => el(id)?.value || '').join('');
  if (code.length < 4) {
    const a = el('otpAlert'); a.textContent = 'Please enter all 4 digits.'; show(a);
    return;
  }

  const btn = el('verifyBtn');
  setLoading(btn, true);
  hide(el('otpAlert'));

  try {
    const res  = await fetch(`${API}/verify-otp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ voterId, otp: code }),
    });
    const data = await res.json();

    if (data.success) {
      clearInterval(timerInterval);
      el('doneEmail').textContent = voterEmail;
      showPanel('done');
      activateStep(3);
    } else {
      const a = el('otpAlert');
      a.textContent = data.message || 'Incorrect OTP.';
      show(a);
    }
  } catch {
    const a = el('otpAlert');
    a.textContent = 'Verification failed. Check your connection.';
    show(a);
  } finally {
    setLoading(btn, false);
  }
};

/* ── Resend OTP ──────────────────────────────────────────────────────────────── */
window.resendOTP = async function () {
  const btn = el('resendBtn');
  if (btn) btn.disabled = true;

  try {
    const res  = await fetch(`${API}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        fullName:      el('fullName').value.trim(),
        rollNumber:    el('rollNumber').value.trim(),
        yearOfPassing: el('yearOfPassing').value.trim(),
        branch:        el('branch').value.trim(),
        email:         voterEmail,
        mobile:        el('mobile').value.trim(),
        cityCountry:   el('cityCountry').value.trim(),
        company:       el('company').value.trim(),
        designation:   el('designation').value.trim(),
      }),
    });
    const data = await res.json();
    if (data.success) {
      voterId = data.voterId;
      ['v0','v1','v2','v3'].forEach(id => { const c = el(id); if (c) c.value = ''; });
      hide(el('otpAlert'));
      startTimer(600);
      toast('New code sent! Check your email.', 'ok');
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
  const cells = ['v0','v1','v2','v3'].map(id => el(id));
  cells.forEach((cell, i) => {
    if (!cell) return;
    cell.addEventListener('input', () => {
      cell.value = cell.value.replace(/\D/g,'').slice(0,1);
      if (cell.value && i < 3) cells[i+1]?.focus();
    });
    cell.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !cell.value && i > 0) cells[i-1]?.focus();
    });
    cell.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'').slice(0,4);
      [...pasted].forEach((ch, j) => { if (cells[j]) cells[j].value = ch; });
      cells[Math.min(pasted.length, 3)]?.focus();
    });
  });
});
