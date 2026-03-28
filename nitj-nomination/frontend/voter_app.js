'use strict';

const API_VOTER = 'http://localhost:5000/api/voter';
let currentVoterId = null;

// Helper to switch panels
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${id}`).classList.add('active');
  
  if(id === 'ballot') document.getElementById('st2').classList.add('active');
  if(id === 'success') document.getElementById('st3').classList.add('done');
}

// 1. Register/Verify Eligibility
document.getElementById('voter-reg-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    fullName: document.getElementById('v_name').value,
    rollNumber: document.getElementById('v_roll').value,
    email: document.getElementById('v_email').value
  };

  try {
    const res = await fetch(`${API_VOTER}/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      currentVoterId = data.voterId;
      document.getElementById('display-email').textContent = payload.email;
      showPanel('otp');
    } else {
      const errBox = document.getElementById('voter-error');
      errBox.textContent = data.message; // Shows "You have not registered..." if ineligible
      errBox.classList.add('show');
    }
  } catch (err) { alert("Server error"); }
});

// 2. Access Code Logic (4-Digits) [cite: 140]
document.getElementById('verify-code-btn').addEventListener('click', async () => {
  const code = Array.from(document.querySelectorAll('#otp-inputs input')).map(i => i.value).join('');
  
  const res = await fetch(`${API_VOTER}/verify-otp`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ voterId: currentVoterId, otp: code })
  });

  const data = await res.json();
  if (data.success) {
    await loadBallot();
    showPanel('ballot');
  } else { alert(data.message); }
});

// 3. Load Candidates (Approved Only)
async function loadBallot() {
  try {
    const res = await fetch(`${API_VOTER}/ballot/${currentVoterId}`);
    const data = await res.json();
    
    if (!data.success) return alert(data.message);

    const ballotContent = document.getElementById('dynamic-ballot-content');
    const councilGrid = document.getElementById('council-grid');
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

    // Executive Council (8 Seats) 
    if (data.ballot['Executive Council Member']) {
      data.ballot['Executive Council Member'].forEach(cand => {
        councilGrid.innerHTML += createCandidateCard(cand, 'executiveMemberIds', 'checkbox', true);
      });
    }
  } catch (err) { console.error("Load failed", err); }
}

function createCandidateCard(cand, name, type, isExec = false) {
  const inputName = isExec ? 'executiveMemberIds' : name.replace(/\s+/g, '');
  return `
    <label class="cand-card ${isExec ? 'exec-style' : ''}" id="label-${cand._id}">
      <input type="${type}" name="${inputName}" value="${cand._id}" onchange="handleSelection(this, '${cand._id}')">
      <div class="cand-name">${cand.fullName}</div>
      <div class="cand-meta">${cand.branch} | Class of ${cand.yearOfPassing}</div>
      <div class="cand-dot"></div>
    </label>
  `;
}

// 4. Handle UI selection and Council limits [cite: 132]
window.handleSelection = (input, id) => {
  const card = document.getElementById(`label-${id}`);
  
  if (input.type === 'radio') {
    document.querySelectorAll(`input[name="${input.name}"]`).forEach(i => {
      document.getElementById(`label-${i.value}`).classList.remove('selected');
    });
  } else {
    const checked = document.querySelectorAll('input[name="executiveMemberIds"]:checked');
    if (checked.length > 8) {
      input.checked = false;
      return alert("You can select a maximum of 8 Executive Council members.");
    }
    document.getElementById('exec-count').textContent = checked.length;
  }
  
  input.checked ? card.classList.add('selected') : card.classList.remove('selected');
};

// 5. Submit Final Vote (FIXED NAMING)
document.getElementById('final-ballot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // This helper now removes spaces to match the input names like "GeneralSecretary"
    const getVal = (name) => {
        const cleanName = name.replace(/\s+/g, ''); 
        return document.querySelector(`input[name="${cleanName}"]:checked`)?.value;
    };
    
    const payload = {
        voterId: currentVoterId,
        presidentCandidateId: getVal('President'),
        generalSecretaryCandidateId: getVal('General Secretary'), // Space is fine here, getVal cleans it
        treasurerCandidateId: getVal('Treasurer'),
        coTreasurerCandidateId: getVal('Co-Treasurer'),
        executiveMemberIds: Array.from(document.querySelectorAll('input[name="executiveMemberIds"]:checked')).map(i => i.value)
    };

    // DEBUG: Right-click -> Inspect -> Console to see this!
    console.log("Voter ID:", currentVoterId);
    console.log("Full Payload:", payload);

    if (!payload.voterId) {
        return alert("Voter session expired. Please refresh and log in again.");
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
            alert(data.message || "Submission failed.");
        }
    } catch (err) { 
        console.error("Submission failed", err);
        alert("Network Error: Could not reach the server."); 
    }
});