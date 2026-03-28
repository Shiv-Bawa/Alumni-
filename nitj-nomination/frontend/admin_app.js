'use strict';

// 1. Correct the API URL (No trailing slash)
const API_ADMIN = 'http://localhost:5000/api/nomination';

document.addEventListener('DOMContentLoaded', () => {
  fetchNominations();
});

// 2. Fetch all nominations from the backend
async function fetchNominations() {
  try {
    const res = await fetch(`${API_ADMIN}/admin/all`);
    const result = await res.json();

    if (result.success) {
      renderAdminPanel(result.data);
    } else {
      console.error("Failed to load nominations from server");
    }
  } catch (err) {
    console.error("Network Error: Make sure backend is running on port 5000", err);
  }
}

// 3. Render the candidates and results into your HTML
function renderAdminPanel(nominations) {
  const nomineeList = document.getElementById('nomineeList');
  const resultsView = document.getElementById('adminResultsView');
  
  nomineeList.innerHTML = '';
  resultsView.innerHTML = '';

  if (nominations.length === 0) {
    nomineeList.innerHTML = '<p class="card-desc">No nominations found in database.</p>';
    return;
  }

  nominations.forEach(nom => {
    // Verification Section
    const verifyRow = document.createElement('div');
    verifyRow.className = 'candidate-row'; 
    verifyRow.style = "display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee; margin-bottom: 10px; background: #fff; border-radius: 8px;";
    
    verifyRow.innerHTML = `
      <div>
        <h4 style="margin:0; color:#7b0000;">${nom.candidateDetails.fullName}</h4>
        <small><strong>Roll:</strong> ${nom.candidateDetails.rollNumber} | <strong>UTR:</strong> ${nom.paymentDetails.transactionNumber}</small><br>
        <small style="color:#c9964a;">Positions: ${Array.isArray(nom.positionsApplied) ? nom.positionsApplied.join(', ') : nom.positionsApplied}</small>
      </div>
      <div>
        ${nom.isAdminVerified 
          ? '<span style="color:#2e7d32; font-weight:700;">✅ Approved</span>' 
          : `<button onclick="approveCandidate('${nom.nominationId}')" style="background:#7b0000; color:#fff; border:none; padding:8px 16px; border-radius:4px; cursor:pointer; font-weight:600;">Verify & Approve</button>`
        }
      </div>
    `;
    nomineeList.appendChild(verifyRow);

    // Results Section
    const resultRow = document.createElement('div');
    resultRow.style = "display: flex; justify-content: space-between; padding: 12px; border-bottom: 1px solid #ddd;";
    resultRow.innerHTML = `
      <span>${nom.candidateDetails.fullName} <small>(${Array.isArray(nom.positionsApplied) ? nom.positionsApplied[0] : nom.positionsApplied})</small></span>
      <strong style="color:#7b0000;">${nom.votes || 0} Votes</strong>
    `;
    resultsView.appendChild(resultRow);
  });
}

// 4. Logic for the Approve Button (Using PATCH)
async function approveCandidate(id) {
  if (!confirm("Confirm ₹5,000 fee and Degree verification for this candidate?")) return;

  try {
    const res = await fetch(`${API_ADMIN}/admin/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nominationId: id, isVerified: true })
    });

    const data = await res.json();
    if (data.success) {
      alert("Candidate Approved! They will now appear on the public ballot.");
      fetchNominations(); // Refresh list automatically
    }
  } catch (err) {
    alert("Error approving candidate. Check console.");
  }
}