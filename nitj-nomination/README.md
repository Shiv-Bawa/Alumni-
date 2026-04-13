# 🎓 NITJ Alumni Election – Nomination System

A full-stack online election management system for the **NIT Jalandhar Alumni Association (NITJAA)**. Built to handle the complete election lifecycle — from candidate nominations to secure voting and result declaration.

---

## Overview

The NITJAA Election Portal digitalises the entire alumni election process. Candidates can submit their nominations online, the admin reviews and approves them, registered alumni voters receive OTP-verified access to cast their votes, and results are securely visible only to the admin.

---



## Features

### Nomination Module
- Candidates can apply for one or more positions in a single form
- OTP-based email verification (4-digit, 10-minute expiry) before submission
- File uploads: payment screenshot (₹5,000 election fee) and proof of NITJ association
- Declaration acceptance required before submission
- Nomination goes to admin for review after email verification

### Admin Dashboard
- Secure login with JWT-protected session (8-hour expiry)
- View all submitted nominations with full candidate details
- Approve or reject nominations with optional remarks
- Only approved candidates appear on the voter ballot
- View complete election results (admin-only, never exposed to voters)
- Dashboard summary: total nominations, pending/approved/rejected counts, votes cast


### Voter Registration
- Separate registration page where voters fill in their details
- 4-digit OTP sent to email for verification
- On successful OTP verification, voter record is saved to the database

### Voting Platform
- Separate voting page — voter enters their registered email and roll number
- System matches details against the registered voter database
- If not registered → redirected to registration page
- If already voted → blocked with a clear message
- Ballot shows only admin-approved candidates grouped by position
- Positions: President, General Secretary, Treasurer, Co-Treasurer (select 1 each), Executive Council Member (select up to 8)
- One vote per voter — enforced at both application and database level using MongoDB atomic transactions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT (admin), OTP via email (candidates & voters) |
| Email | Nodemailer with Gmail SMTP |
| File Uploads | Multer |
| Frontend | Plain HTML, CSS, Vanilla JavaScript |
| Security | bcrypt, helmet, express-mongo-sanitize, express-rate-limit |

---









## 🚀 Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in your values
npm run dev               # starts on http://localhost:5000
```

**Required `.env` values:**

| Key | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `EMAIL_USER` | Gmail address |
| `EMAIL_PASS` | Gmail App Password (not your login password) |
| `FRONTEND_URL` | Frontend URL for CORS (e.g. `http://localhost:3000`) |

> **Gmail App Password:** Enable 2-Step Verification → Google Account → Security → App Passwords → Generate one for "Mail".

### 2. Frontend

The frontend is **pure static files** — just open in a browser or serve with any static server:

```bash
cd frontend

# Option A: VS Code Live Server (recommended for dev)
# Option B: simple static server
npx serve .               # serves on http://localhost:3000

# Option C: open index.html directly in browser
# (CORS will block API calls — use a server)
```

Make sure `API_BASE` in `app.js` points to your backend URL (default: `http://localhost:5000/api/nomination`).

---


## 🔐 Security Features

- **OTP hashed** with bcrypt before storing — never stored in plain text
- **OTP expires** in 5 minutes (server-enforced)
- **Max 5 wrong OTP attempts** before lockout
- **Rate limiting**: 3 OTP sends/10 min, 5 verify attempts/10 min
- **Duplicate prevention**: unique index on email for confirmed nominations
- **File validation**: MIME type + extension checked server-side
- **NoSQL injection protection**: `express-mongo-sanitize`
- **Security headers**: `helmet`
- **Input sanitization**: `express-validator` on all fields
- **CORS**: only frontend origin allowed

---

## 🗄️ MongoDB Schema (Summary)

```
Nomination {
  nominationId          NITJ-XXXXXXXX (unique)
  positionsApplied      String[]
  candidateDetails {
    fullName, rollNumber, yearOfPassingOut, branch,
    email, mobile, currentCity, currentCountry,
    company, designation
  }
  paymentDetails {
    transactionNumber, paymentScreenshotPath
  }
  proofOfAssociationPath
  declarationAccepted
  isEmailVerified
  otpHash               (select: false — never exposed)
  otpExpiry             (select: false)
  otpAttempts           (select: false)
  status                pending_otp | submitted
  submittedAt
  createdAt / updatedAt
}
```
