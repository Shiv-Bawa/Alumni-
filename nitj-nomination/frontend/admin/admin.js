'use strict';

const API = 'http://localhost:5000/api/admin';
let token     = localStorage.getItem('nitjaa_admin_token') || null;
let adminInfo = JSON.parse(localStorage.getItem('nitjaa_admin_info') || 'null');

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
const el   = id => document.getElementById(id);
const show = e  => { if (e) e.style.display = ''; };
const hide = e  => { if (e) e.style.display = 'none'; };

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type = '') {
  const t = el('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 4000);
}

function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  const lbl  = btn.querySelector('.btn-label');
  const spin = btn.querySelector('.btn-spin');
  if (lbl)  lbl.style.display  = on ? 'none' : '';
  if (spin) spin.style.display = on ? '' : 'none';
}

/* ── API wrapper ─────────────────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body instanceof FormData) delete headers['Content-Type'];

  const res  = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json();

  if (res.status === 401) {
    doLogout();
    return { ok: false, data: { message: 'Session expired.' } };
  }
  return { ok: res.ok, data };
}

/* ── Auth ────────────────────────────────────────────────────────────────────── */
window.doLogin = async function () {
  const btn      = el('loginBtn');
  const errEl    = el('loginErr');
  const username = (el('username')?.value || '').trim();
  const password = (el('password')?.value || '');

  hide(errEl);
  if (!username || !password) {
    errEl.textContent = 'Enter username and password.';
    show(errEl);
    return;
  }

  setLoading(btn, true);
  try {
    const res  = await fetch(`${API}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (data.success) {
      token     = data.token;
      adminInfo = data.admin;
      localStorage.setItem('nitjaa_admin_token', token);
      localStorage.setItem('nitjaa_admin_info',  JSON.stringify(adminInfo));
      window.location.href = 'admin_dashboard.html';
    } else {
      errEl.textContent = data.message || 'Login failed.';
      show(errEl);
    }
  } catch {
    errEl.textContent = 'Cannot reach server. Is the backend running on port 5000?';
    show(errEl);
  } finally {
    setLoading(btn, false);
  }
};

window.doLogout = function () {
  token = null; adminInfo = null;
  localStorage.removeItem('nitjaa_admin_token');
  localStorage.removeItem('nitjaa_admin_info');
  window.location.href = 'admin_login.html';
};

/* ── Dashboard init ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // Allow Enter key on login page
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && el('loginBtn')) window.doLogin();
  });

  // Dashboard page init
  if (!el('tab-overview')) return;

  if (!token) { window.location.href = 'admin_login.html'; return; }

  if (el('adminName')) el('adminName').textContent = `👤 ${adminInfo?.username || 'Admin'}`;

  // Sidebar tab clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Load first tab
  switchTab('overview');
});

/* ── Tab switching ───────────────────────────────────────────────────────────── */
const TAB_TITLES = {
  overview:    'Overview',
  nominations: 'Nominations',
  results:     'Election Results',
};

window.switchTab = function (tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const panel = el(`tab-${tab}`);
  const navItem = document.querySelector(`[data-tab="${tab}"]`);
  if (panel)   panel.classList.add('active');
  if (navItem) navItem.classList.add('active');

  if (el('topbarTitle')) el('topbarTitle').textContent = TAB_TITLES[tab] || tab;

  if (tab === 'overview')    loadOverview();
  if (tab === 'nominations') loadNominations();
  if (tab === 'results')     loadResults();
};

/* ── Overview ────────────────────────────────────────────────────────────────── */
async function loadOverview() {
  try {
    const { ok, data } = await apiFetch('/dashboard');
    if (!ok) { toast(data.message || 'Failed to load dashboard.', 'bad'); return; }

    const s = data.summary;
    el('s-totalNom').textContent = s.totalNom;
    el('s-pending').textContent  = s.pendingNom;
    el('s-approved').textContent = s.approvedNom;
    el('s-rejected').textContent = s.rejectedNom;
    el('s-voters').textContent   = s.totalVoters;
    el('s-votes').textContent    = s.totalVotes;

    // Show first 5 pending nominations in overview
    const { ok: ok2, data: nd } = await apiFetch('/nominations?status=pending_admin');
    if (ok2) renderNomCards(el('overviewPending'), (nd.nominations || []).slice(0, 5), true);
  } catch {
    toast('Failed to load overview.', 'bad');
  }
}

/* ── Nominations ─────────────────────────────────────────────────────────────── */
window.loadNominations = async function () {
  const filter = el('nomFilter')?.value || '';
  const url    = filter ? `/nominations?status=${filter}` : '/nominations';

  try {
    const { ok, data } = await apiFetch(url);
    if (!ok) { toast(data.message || 'Failed to load.', 'bad'); return; }
    renderNomCards(el('nominationsList'), data.nominations || [], false);
  } catch {
    toast('Failed to load nominations.', 'bad');
  }
};

function renderNomCards(container, nominations, compact) {
  if (!container) return;

  if (!nominations.length) {
    container.innerHTML = '<div class="empty"><span>📭</span>No nominations found.</div>';
    return;
  }

  container.innerHTML = nominations.map(n => {
    const s        = n.status;
    const badgeCls = { pending_admin: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' }[s] || 'badge-pending';
    const badgeLbl = { pending_admin: 'Pending',       approved: 'Approved',       rejected: 'Rejected'       }[s] || s;
    const date     = n.submittedAt ? new Date(n.submittedAt).toLocaleDateString('en-IN') : '—';
    const c        = n.candidate || {};

    return `
      <div class="nom-card">
        <div class="nom-info">
          <h3>${esc(c.fullName)}</h3>
          <p>${esc(c.email)} &nbsp;·&nbsp; Roll: ${esc(c.rollNumber)} &nbsp;·&nbsp; ${esc(c.branch)}</p>
          <p style="margin-top:2px">${esc(c.company)} — ${esc(c.designation)}</p>
        </div>
        <div class="nom-badges">
          ${(n.positions || []).map(p => `<span class="badge badge-pos">${esc(p)}</span>`).join('')}
          <span class="badge ${badgeCls}">${badgeLbl}</span>
          <span style="font-size:.75rem;color:var(--muted)">${date}</span>
        </div>
        <div class="nom-actions">
          <button class="btn-outline btn-sm" onclick="openNomModal('${esc(n.nominationId)}')">View Details</button>
          ${!compact && s === 'pending_admin' ? `
            <button class="btn-success" onclick="quickReview('${esc(n.nominationId)}','approve')">✓ Approve</button>
            <button class="btn-danger"  onclick="quickReview('${esc(n.nominationId)}','reject')">✕ Reject</button>
          ` : ''}
        </div>
      </div>`;
  }).join('');
}

window.quickReview = async function (nominationId, action) {
  if (!confirm(`${action === 'approve' ? 'Approve' : 'Reject'} this nomination?`)) return;
  try {
    const { ok, data } = await apiFetch(`/nominations/${nominationId}/review`, {
      method: 'POST',
      body:   JSON.stringify({ action }),
    });
    toast(data.message, ok ? 'ok' : 'bad');
    if (ok) { loadNominations(); loadOverview(); }
  } catch {
    toast('Action failed.', 'bad');
  }
};

/* ── Nomination Modal ────────────────────────────────────────────────────────── */
let currentNomId = null;

window.openNomModal = async function (nominationId) {
  currentNomId = nominationId;

  try {
    const { ok, data } = await apiFetch('/nominations');
    if (!ok) { toast('Failed to load.', 'bad'); return; }

    const n = (data.nominations || []).find(x => x.nominationId === nominationId);
    if (!n) { toast('Nomination not found.', 'bad'); return; }

    const c   = n.candidate   || {};
    const p   = n.proposer    || {};
    const pd  = n.paymentDetails || {};
    const s   = n.status;
    const badgeCls = { pending_admin: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' }[s] || '';
    const badgeLbl = { pending_admin: 'Pending Review', approved: 'Approved',       rejected: 'Rejected'       }[s] || s;

    el('modalTitle').textContent = `Nomination — ${c.fullName || '—'}`;

    el('modalBody').innerHTML = `
      <div class="modal-row"><strong>Nomination ID:</strong> ${esc(n.nominationId)}</div>
      <div class="modal-row"><strong>Status:</strong> <span class="badge ${badgeCls}">${badgeLbl}</span></div>
      <div class="modal-row"><strong>Position(s):</strong>
        ${(n.positions || []).map(pos => `<span class="badge badge-pos">${esc(pos)}</span>`).join(' ')}
      </div>

      <hr style="margin:14px 0;border:none;border-top:1px solid var(--border)">
      <p style="font-weight:700;margin-bottom:10px;font-size:.88rem;color:var(--navy)">Candidate Details</p>
      <div class="modal-row"><strong>Full Name:</strong>      ${esc(c.fullName)}</div>
      <div class="modal-row"><strong>Email:</strong>          ${esc(c.email)}</div>
      <div class="modal-row"><strong>Roll Number:</strong>    ${esc(c.rollNumber)}</div>
      <div class="modal-row"><strong>Branch:</strong>         ${esc(c.branch)}</div>
      <div class="modal-row"><strong>Year of Passing:</strong>${c.yearOfPassing || '—'}</div>
      <div class="modal-row"><strong>Mobile:</strong>         ${esc(c.mobile)}</div>
      <div class="modal-row"><strong>City &amp; Country:</strong>${esc(c.cityCountry)}</div>
      <div class="modal-row"><strong>Company:</strong>        ${esc(c.company)}</div>
      <div class="modal-row"><strong>Designation:</strong>   ${esc(c.designation)}</div>

      <hr style="margin:14px 0;border:none;border-top:1px solid var(--border)">
      <p style="font-weight:700;margin-bottom:10px;font-size:.88rem;color:var(--navy)">Proposer Details</p>
      <div class="modal-row"><strong>Full Name:</strong>   ${esc(p.fullName)}</div>
      <div class="modal-row"><strong>Email:</strong>       ${esc(p.email)}</div>
      <div class="modal-row"><strong>Roll Number:</strong> ${esc(p.rollNumber)}</div>
      <div class="modal-row"><strong>Branch:</strong>      ${esc(p.branch)}</div>
      <div class="modal-row"><strong>Mobile:</strong>      ${esc(p.mobile)}</div>
      <div class="modal-row"><strong>City &amp; Country:</strong>${esc(p.cityCountry)}</div>
      <div class="modal-row"><strong>Company:</strong>     ${esc(p.company)}</div>
      <div class="modal-row"><strong>Designation:</strong> ${esc(p.designation)}</div>

      <hr style="margin:14px 0;border:none;border-top:1px solid var(--border)">
      <p style="font-weight:700;margin-bottom:10px;font-size:.88rem;color:var(--navy)">Payment &amp; Documents</p>
      <div class="modal-row"><strong>Transaction No:</strong> ${esc(pd.transactionNumber)}</div>
      <div class="modal-row"><strong>Payment Screenshot:</strong>
        <a class="modal-link" href="http://localhost:5000/${esc(pd.paymentScreenshotPath)}" target="_blank">View File ↗</a>
      </div>
      <div class="modal-row"><strong>Candidate Proof:</strong>
        <a class="modal-link" href="http://localhost:5000/${esc(n.candidateProofPath)}" target="_blank">View File ↗</a>
      </div>
      <div class="modal-row"><strong>Proposer Proof:</strong>
        <a class="modal-link" href="http://localhost:5000/${esc(n.proposerProofPath)}" target="_blank">View File ↗</a>
      </div>
      <div class="modal-row"><strong>Proposer Email Proof:</strong>
        <a class="modal-link" href="http://localhost:5000/${esc(n.proposerEmailPath)}" target="_blank">View File ↗</a>
      </div>
      ${n.adminRemarks ? `<div class="modal-row"><strong>Admin Remarks:</strong> ${esc(n.adminRemarks)}</div>` : ''}
      ${s === 'pending_admin' ? `
        <div class="remarks-area">
          <label>Remarks (optional):</label>
          <textarea id="modalRemarks" placeholder="Add remarks for your records…"></textarea>
        </div>` : ''}
    `;

    el('modalActions').innerHTML = s === 'pending_admin' ? `
      <button class="btn-success" onclick="modalReview('approve')">✓ Approve Nomination</button>
      <button class="btn-danger"  onclick="modalReview('reject')">✕ Reject Nomination</button>
      <button class="btn-outline" onclick="closeModal()">Cancel</button>
    ` : `<button class="btn-outline" onclick="closeModal()">Close</button>`;

    show(el('nomModal'));

  } catch {
    toast('Failed to load nomination details.', 'bad');
  }
};

window.modalReview = async function (action) {
  const remarks = el('modalRemarks')?.value || '';
  try {
    const { ok, data } = await apiFetch(`/nominations/${currentNomId}/review`, {
      method: 'POST',
      body:   JSON.stringify({ action, remarks }),
    });
    toast(data.message, ok ? 'ok' : 'bad');
    if (ok) { closeModal(); loadNominations(); loadOverview(); }
  } catch {
    toast('Action failed.', 'bad');
  }
};

window.closeModal = function () {
  hide(el('nomModal'));
  currentNomId = null;
};

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target === el('nomModal')) window.closeModal();
});

/* ── Election Results ────────────────────────────────────────────────────────── */
window.loadResults = async function () {
  const container = el('resultsContainer');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--muted);padding:20px 0">Loading results…</p>';

  try {
    const { ok, data } = await apiFetch('/results');
    if (!ok) { container.innerHTML = `<div class="alert err">${esc(data.message)}</div>`; return; }

    const { totalVotes, results } = data;

    if (totalVotes === 0) {
      container.innerHTML = '<div class="empty"><span>📊</span>No votes have been cast yet.</div>';
      return;
    }

    let html = `<p style="margin-bottom:20px;font-size:.88rem;color:var(--muted)">
      Total ballots cast: <strong>${totalVotes}</strong>
    </p>`;

    for (const [position, candidates] of Object.entries(results)) {
      if (!candidates || !candidates.length) continue;

      const maxVotes = candidates[0].voteCount || 1;

      html += `
        <div class="result-section">
          <h3>${esc(position)}</h3>
          ${candidates.map((c, i) => {
            const rank  = ['🥇','🥈','🥉'][i] || (i + 1);
            const pct   = Math.round((c.voteCount / maxVotes) * 100);
            return `
              <div class="result-row">
                <div class="result-rank">${rank}</div>
                <div class="result-info">
                  <strong>${esc(c.fullName)}</strong>
                  <span>${esc(c.branch)}${c.company ? ' · ' + esc(c.company) : ''}</span>
                </div>
                <div class="result-bar-wrap">
                  <div class="result-bar-bg">
                    <div class="result-bar-fill" style="width:${pct}%"></div>
                  </div>
                </div>
                <div class="result-count">${c.voteCount} vote${c.voteCount !== 1 ? 's' : ''}</div>
              </div>`;
          }).join('')}
        </div>`;
    }

    container.innerHTML = html;

  } catch {
    container.innerHTML = '<div class="alert err">Failed to load results.</div>';
  }
};
