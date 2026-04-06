'use strict';

const API = 'http://localhost:5000/api/voter';
let voterId   = null;
let voterName = '';
let ballot    = {};

let selections = {
  president:        null,
  generalSecretary: null,
  treasurer:        null,
  coTreasurer:      null,
  execMembers:      [],
};

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

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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
  ['login', 'ballot', 'done'].forEach(p => {
    const panel = el(`panel-${p}`);
    if (panel) panel.classList.remove('active');
  });
  const target = el(`panel-${name}`);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Step 1: Verify voter identity ──────────────────────────────────────────── */
window.verifyVoter = async function () {
  const btn = el('loginBtn');
  const emailVal      = (el('loginEmail')?.value || '').trim().toLowerCase();
  const rollNumberVal = (el('loginRollNumber')?.value || '').trim();

  // Clear previous messages
  hide(el('loginAlert'));
  hide(el('notRegisteredBox'));
  hide(el('alreadyVotedBox'));

  // Basic client validation
  let hasErr = false;
  if (!emailVal) {
    el('err-loginEmail').textContent = 'Email is required.';
    el('loginEmail').classList.add('err');
    hasErr = true;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    el('err-loginEmail').textContent = 'Enter a valid email.';
    el('loginEmail').classList.add('err');
    hasErr = true;
  } else {
    el('err-loginEmail').textContent = '';
    el('loginEmail').classList.remove('err');
  }

  if (!rollNumberVal) {
    el('err-loginRollNumber').textContent = 'Roll number is required.';
    el('loginRollNumber').classList.add('err');
    hasErr = true;
  } else {
    el('err-loginRollNumber').textContent = '';
    el('loginRollNumber').classList.remove('err');
  }

  if (hasErr) return;

  setLoading(btn, true);

  try {
    const res  = await fetch(`${API}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: emailVal, rollNumber: rollNumberVal }),
    });
    const data = await res.json();

    if (data.success) {
      // Voter verified — load ballot
      voterId   = data.voterId;
      voterName = data.fullName;
      el('voterNameDisplay').textContent = voterName;
      showPanel('ballot');
      activateStep(2);
      loadBallot();

    } else if (data.alreadyVoted) {
      // Voter already voted
      hide(el('loginForm'));
      show(el('alreadyVotedBox'));

    } else if (data.notRegistered) {
      // Voter not found in DB
      el('notRegisteredMsg').textContent = data.message;
      hide(el('loginForm'));
      show(el('notRegisteredBox'));

    } else {
      // Details don't match (wrong email or roll number)
      const alertEl = el('loginAlert');
      alertEl.textContent = data.message || 'Verification failed.';
      show(alertEl);
    }

  } catch {
    const alertEl = el('loginAlert');
    alertEl.textContent = 'Cannot reach server. Is the backend running on port 5000?';
    show(alertEl);
  } finally {
    setLoading(btn, false);
  }
};

/* ── Step 2: Load ballot ─────────────────────────────────────────────────────── */
async function loadBallot() {
  const container = el('ballotContainer');
  container.innerHTML = '<p style="text-align:center;padding:40px;color:#666">Loading ballot…</p>';

  try {
    const res  = await fetch(`${API}/ballot/${voterId}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<p style="color:red;text-align:center;padding:30px">${data.message}</p>`;
      return;
    }

    ballot = data.ballot;
    renderBallot();

  } catch {
    container.innerHTML = '<p style="color:red;text-align:center;padding:30px">Failed to load ballot. Please refresh the page.</p>';
  }
}

function renderBallot() {
  const container = el('ballotContainer');

  const positions = [
    { key: 'President',               field: 'president',        multi: false, rule: 'Select 1 candidate'       },
    { key: 'General Secretary',       field: 'generalSecretary', multi: false, rule: 'Select 1 candidate'       },
    { key: 'Treasurer',               field: 'treasurer',        multi: false, rule: 'Select 1 candidate'       },
    { key: 'Co-Treasurer',            field: 'coTreasurer',      multi: false, rule: 'Select 1 candidate'       },
    { key: 'Executive Council Member',field: 'execMembers',      multi: true,  rule: 'Select up to 8 candidates' },
  ];

  container.innerHTML = positions.map(pos => {
    const cands = ballot[pos.key] || [];

    const counter = pos.multi
      ? `<div class="exec-counter">Selected: <span class="exec-count" id="exec-count">0</span> / 8</div>`
      : '';

    const cards = cands.length === 0
      ? `<p class="no-candidates">No approved candidates for this position.</p>`
      : cands.map(c => `
          <label class="cand-card" id="cc-${pos.field}-${c._id}">
            <input type="${pos.multi ? 'checkbox' : 'radio'}" name="${pos.field}" value="${c._id}"
              onchange="handleSelect('${pos.field}','${c._id}',this,${pos.multi})" />
            <div class="cand-name">${esc(c.fullName)}</div>
            <div class="cand-meta">${esc(c.branch)} · ${c.yearOfPassing}<br>${esc(c.designation)} — ${esc(c.company)}</div>
            <span class="cand-tick">✓</span>
          </label>`
        ).join('');

    return `
      <div class="position-block">
        <div class="pos-header">
          <span class="pos-title">${esc(pos.key)}</span>
          <span class="pos-rule">${pos.rule}</span>
        </div>
        ${counter}
        <div class="candidates-grid">${cards}</div>
      </div>`;
  }).join('');

  checkAllSelected();
}

window.handleSelect = function (field, candidateId, inputEl, isMulti) {
  const card = el(`cc-${field}-${candidateId}`);

  if (isMulti) {
    if (inputEl.checked) {
      if (selections.execMembers.length >= 8) {
        inputEl.checked = false;
        toast('Maximum 8 Executive Council Members allowed.', 'bad');
        return;
      }
      selections.execMembers.push(candidateId);
      card?.classList.add('selected');
    } else {
      selections.execMembers = selections.execMembers.filter(id => id !== candidateId);
      card?.classList.remove('selected');
    }
    const cnt = el('exec-count');
    if (cnt) cnt.textContent = selections.execMembers.length;
  } else {
    document.querySelectorAll(`input[name="${field}"]`).forEach(inp => {
      el(`cc-${field}-${inp.value}`)?.classList.remove('selected');
    });
    selections[field] = candidateId;
    card?.classList.add('selected');
  }

  checkAllSelected();
};

function checkAllSelected() {
  const singles  = ['president', 'generalSecretary', 'treasurer', 'coTreasurer'];
  const keyMap   = { president: 'President', generalSecretary: 'General Secretary', treasurer: 'Treasurer', coTreasurer: 'Co-Treasurer' };
  const required = singles.filter(f => (ballot[keyMap[f]] || []).length > 0);
  const singlesOk = required.every(f => selections[f] !== null);
  const execOk    = (ballot['Executive Council Member'] || []).length === 0 || selections.execMembers.length >= 1;
  el('castVoteBtn').disabled = !(singlesOk && execOk);
}

/* ── Step 3: Cast vote ───────────────────────────────────────────────────────── */
let submitting = false;

window.castVote = async function () {
  if (submitting) return;
  submitting = true;

  const btn = el('castVoteBtn');
  setLoading(btn, true);
  hide(el('ballotAlert'));

  try {
    const res  = await fetch(`${API}/submit-vote`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        voterId,
        presidentId:        selections.president,
        generalSecretaryId: selections.generalSecretary,
        treasurerId:        selections.treasurer,
        coTreasurerId:      selections.coTreasurer,
        execMemberIds:      selections.execMembers,
      }),
    });
    const data = await res.json();

    if (data.success) {
      showPanel('done');
      activateStep(3);
    } else {
      el('ballotAlertMsg').textContent = data.message || 'Vote submission failed.';
      show(el('ballotAlert'));
      submitting = false;
      setLoading(btn, false);
    }
  } catch {
    el('ballotAlertMsg').textContent = 'Network error. Please try again.';
    show(el('ballotAlert'));
    submitting = false;
    setLoading(btn, false);
  }
};

/* ── DOM Ready ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Allow pressing Enter on login form
  ['loginEmail', 'loginRollNumber'].forEach(id => {
    el(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') window.verifyVoter();
    });
  });
});
