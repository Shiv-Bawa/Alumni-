'use strict';

// 🔥 FIX 1: Explicitly point to Port 5000 (Backend)
const API_VOTER = 'http://localhost:5000/api/voter';
let currentVoterId = null;

// Helper to switch panels
function showPanel(id) {
  const target = document.getElementById(`panel-${id}`);
  if (!target) return;

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  
  if(id === 'ballot') document.getElementById('st2')?.classList.add('active');
  if(id === 'success') document.getElementById('st3')?.classList.add('done');
  
  // Scroll to top when switching panels
  window.scrollTo(0, 0);
}

// 1. Register/Verify Eligibility
const regForm = document.getElementById('voter-reg-form');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const errBox = document.getElementById('voter-error');
    errBox.classList.remove('show');

    // 🔥 FIX 2: Ensure these IDs match your voter.html exactly
    const payload = {
      fullName: document.getElementById('v_name').value.trim(),
      rollNumber: document.getElementById('v_roll').value.trim(),
      email: document.getElementById('v_email').value.trim()
    };

    try {
      const res = await fetch(`${API_VOTER}/register`, {
        method: 'POST', // This matches the router.post in your backend
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        currentVoterId = data.voterId;
        const emailDisplay = document.getElementById('display-email');
        if (emailDisplay) emailDisplay.textContent = payload.email;
        showPanel('otp');
      } else {
        errBox.textContent = data.message || "Registration failed";
        errBox.classList.add('show');
      }
    } catch (err) { 
      console.error("Fetch Error:", err);
      alert("Server connection failed. Is your Backend (Port 5000) running?"); 
    }
  });
}

// 2. Access Code Logic (4-Digits)
const verifyBtn = document.getElementById('verify-code-btn');
if (verifyBtn) {
  verifyBtn.addEventListener('click', async () => {
    const code = Array.from(document.querySelectorAll('#otp-inputs input')).map(i => i.value).join('');
    
    if (code.length < 4) return alert("Please enter the full 4-digit code.");

    try {
      const res = await fetch(`${API_VOTER}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: currentVoterId, otp: code })
      });

      const data = await res.json();
      if (data.success) {
        await loadBallot();
        showPanel('ballot');
      } else { 
        alert(data.message || "Invalid Code"); 
      }
    } catch (err) {
      alert("Verification failed. Check console for details.");
    }
  });
}

// 3. Load Candidates (Approved Only)
async function loadBallot() {
  try {
    const res = await fetch(`${API_VOTER}/ballot/${currentVoterId}`);
    const data = await res.json();
    
    if (!data.success) return alert(data.message);

    const ballotContent = document.getElementById('dynamic-ballot-content');
    const councilGrid = document.getElementById('council-grid');
    if(!ballotContent || !councilGrid) return;

    ballotContent.innerHTML = '';
    councilGrid.innerHTML = '';

    const singleVotePositions = ['President', 'General Secretary', 'Treasurer', 'Co-Treasurer'];

    singleVotePositions.forEach(pos => {
      if (data.ballot[pos] && data.ballot[pos].length > 0) {
        const section = document.createElement('div');
        section.className = 'position-block';
        section.innerHTML = `
          <div class="position-header">
            <span class="position-name">${pos}</span>
            <span class="position-rule">Select one</span>
          </div>
          <hr class="position-hr">
          <div class="candidate-grid"></div>
        `;
        ballotContent.appendChild(section);

        const grid = section.querySelector('.candidate-grid');
        data.ballot[pos].forEach(cand => {
          grid.innerHTML += createCandidateCard(cand, pos, 'radio');
        });
      }
    });

    if (data.ballot['Executive Council Member']) {
      data.ballot['Executive Council Member'].forEach(cand => {
        councilGrid.innerHTML += createCandidateCard(cand, 'Executive Council Member', 'checkbox', true);
      });
    }
  } catch (err) { 
    console.error("Load failed", err); 
  }
}

function createCandidateCard(cand, posName, type, isExec = false) {
  // Use a clean name for the input attributes
  const inputName = isExec ? 'executiveMemberIds' : posName.replace(/\s+/g, '');
  return `
    <label class="cand-card ${isExec ? 'exec-style' : ''}" id="label-${cand._id}">
      <input type="${type}" name="${inputName}" value="${cand._id}" onchange="handleSelection(this, '${cand._id}')">
      <div class="cand-name">${cand.fullName}</div>
      <div class="cand-meta">${cand.branch} | Class of ${cand.yearOfPassingOut || cand.yearOfPassing}</div>
      <div class="cand-dot"></div>
    </label>
  `;
}

// 4. Handle UI selection
window.handleSelection = (input, id) => {
  const card = document.getElementById(`label-${id}`);
  
  if (input.type === 'radio') {
    document.querySelectorAll(`input[name="${input.name}"]`).forEach(i => {
      const otherCard = document.getElementById(`label-${i.value}`);
      if(otherCard) otherCard.classList.remove('selected');
    });
  } else {
    const checked = document.querySelectorAll('input[name="executiveMemberIds"]:checked');
    if (checked.length > 8) {
      input.checked = false;
      return alert("You can select a maximum of 8 Executive Council members.");
    }
    const countDisplay = document.getElementById('exec-count');
    if(countDisplay) countDisplay.textContent = checked.length;
  }
  
  if(card) {
    input.checked ? card.classList.add('selected') : card.classList.remove('selected');
  }
};

// 5. Submit Final Vote
const ballotForm = document.getElementById('final-ballot-form');
if (ballotForm) {
  ballotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const getVal = (name) => {
        const cleanName = name.replace(/\s+/g, ''); 
        return document.querySelector(`input[name="${cleanName}"]:checked`)?.value;
    };
    
    const payload = {
        voterId: currentVoterId,
        presidentCandidateId: getVal('President'),
        generalSecretaryCandidateId: getVal('General Secretary'),
        treasurerCandidateId: getVal('Treasurer'),
        coTreasurerCandidateId: getVal('Co-Treasurer'),
        executiveMemberIds: Array.from(document.querySelectorAll('input[name="executiveMemberIds"]:checked')).map(i => i.value)
    };

    if (!payload.voterId) {
        return alert("Voter session expired. Please restart registration.");
    }

    try {
        const res = await fetch(`${API_VOTER}/submit-vote`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.success) {
            showPanel('success');
        } else {
            alert(data.message || "Vote submission failed.");
        }
    } catch (err) { 
        alert("Network Error: Check if server is online."); 
    }
  });
}