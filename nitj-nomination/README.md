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

## Project Structure

```
nitjaa-election-portal/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── uploads/                        ← auto-created, stores uploaded files
│   └── src/
│       ├── config/
│       │   ├── database.js
│       │   └── multer.js
│       ├── models/
│       │   ├── nomination.model.js     ← candidate nominations
│       │   ├── voter.model.js          ← registered voters
│       │   ├── vote.model.js           ← cast votes (atomic)
│       │   └── admin.model.js          ← admin credentials
│       ├── controllers/
│       │   ├── nomination.controller.js
│       │   ├── voter.controller.js
│       │   └── admin.controller.js
│       ├── routes/
│       │   ├── nomination.routes.js
│       │   ├── voter.routes.js
│       │   └── admin.routes.js
│       ├── middleware/
│       │   ├── auth.middleware.js      ← JWT guard for admin routes
│       │   ├── error.middleware.js
│       │   └── rateLimit.middleware.js
│       ├── services/
│       │   ├── otp.service.js          ← OTP generation + bcrypt hashing
│       │   └── email.service.js        ← Nodemailer email templates
│       └── utils/
│           └── seedAdmin.js            ← creates first admin account
│
└── frontend/
    ├── nomination/
    │   ├── nomination.html             ← candidate nomination form
    │   ├── nomination.js
    │   └── nomination.css
    ├── voter/
    │   ├── voter_register.html         ← voter registration + OTP
    │   ├── voter_register.js
    │   ├── voter_register.css
    │   ├── voter_vote.html             ← identity check + voting ballot
    │   ├── voter_vote.js
    │   └── voter_vote.css
    └── admin/
        ├── admin_login.html
        ├── admin_dashboard.html        ← nominations, review, results
        ├── admin.js
        └── admin.css
```

---



## 🚀 Setup

### Prerequisites

- **Node.js** v18 or higher
- **MongoDB** (local installation or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **Gmail account** with an App Password enabled
- **VS Code** with the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension (for frontend)

---

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

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://127.0.0.1:5500

MONGO_URI=mongodb://localhost:27017/nitjaa_election

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_char_app_password

ADMIN_JWT_SECRET=paste_a_long_random_string_here

ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123
```

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Get a Gmail App Password:**
1. Go to [Google Account](https://myaccount.google.com) → Security → 2-Step Verification → Enable it
2. Search "App passwords" → Generate one for "Mail"
3. Use that 16-character password as `SMTP_PASS` — **not** your regular Gmail password

### 3. Create the Admin Account

```bash
npm run seed:admin
```

This creates an admin account using the `ADMIN_USERNAME` and `ADMIN_PASSWORD` from your `.env` file. Run this only once.

### 4. Start the Backend

```bash
npm run dev        # development (auto-restart on changes)
npm start          # production
```

Backend runs at: `http://localhost:5000`

### 5. Open the Frontend

Open any HTML file using **VS Code Live Server** (right-click the file → *Open with Live Server*):

| Page | File |
|---|---|
| Nomination Form | `frontend/nomination/nomination.html` |
| Voter Registration | `frontend/voter/voter_register.html` |
| Voting Page | `frontend/voter/voter_vote.html` |
| Admin Login | `frontend/admin/admin_login.html` |
| Admin Dashboard | `frontend/admin/admin_dashboard.html` |

---

## How It Works

### Nomination Flow

```
Candidate fills form
       ↓
OTP sent to candidate email (4 digits, 10 min)
       ↓
Candidate verifies OTP
       ↓
Nomination saved as "pending_admin"
       ↓
Admin logs in → reviews nomination
       ↓
Admin approves or rejects
       ↓
Approved candidates appear on the voting ballot
```

### Voter Flow

```
Voter goes to voter_register.html
       ↓
Fills personal + professional details
       ↓
OTP sent to registered email
       ↓
Voter verifies OTP → saved to database as "registered"
       ↓
Voter goes to voter_vote.html
       ↓
Enters registered email + roll number
       ↓
System matches against database
       ↓        ↓           ↓
Not found  Already voted  Match found
    ↓            ↓              ↓
Register     Blocked        Ballot opens
  first      (message)   (approved candidates)
                               ↓
                        Voter submits selections
                               ↓
                    Vote recorded (atomic transaction)
                    Voter marked as "has voted"
```

---

## API Reference

### Nomination Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/nomination/submit` | Submit nomination form (multipart/form-data) |
| `POST` | `/api/nomination/verify-otp` | Verify nomination OTP |
| `POST` | `/api/nomination/resend-otp` | Resend nomination OTP |

### Voter Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/voter/register` | Register voter + send OTP |
| `POST` | `/api/voter/verify-otp` | Verify OTP → save to database |
| `POST` | `/api/voter/login` | Verify identity on voting page (email + roll number) |
| `GET`  | `/api/voter/ballot/:voterId` | Fetch approved candidates grouped by position |
| `POST` | `/api/voter/submit-vote` | Cast vote (atomic transaction) |

### Admin Endpoints (JWT protected)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/login` | Public | Admin login, returns JWT |
| `GET`  | `/api/admin/dashboard` | ✅ | Stats summary |
| `GET`  | `/api/admin/nominations` | ✅ | List nominations (filter by status) |
| `POST` | `/api/admin/nominations/:id/review` | ✅ | Approve or reject a nomination |
| `GET`  | `/api/admin/results` | ✅ | Election results (admin-only) |

---

## Security

- **OTP** — 4-digit codes hashed with bcrypt before storing, 10-minute expiry, max 5 attempts before lockout
- **Rate limiting** — OTP send: 3 requests per 10 min per IP/email; API: 100 requests per 15 min
- **Passwords** — bcrypt with 12 salt rounds
- **Admin JWT** — 8-hour expiry, role-checked on every protected route
- **One vote per person** — unique index on `voterId` in the votes collection; vote + `hasVoted` flag written in a single MongoDB atomic transaction
- **CORS** — restricted to known frontend origins only
- **MongoDB injection** — sanitised with `express-mongo-sanitize`
- **Security headers** — `helmet` applied to all responses
- **File validation** — only JPG, PNG, PDF accepted; max 5 MB per file

---

## Positions on the Ballot

| Position | Selection |
|---|---|
| President | Pick 1 |
| General Secretary | Pick 1 |
| Treasurer | Pick 1 |
| Co-Treasurer | Pick 1 |
| Executive Council Member | Pick up to 8 |

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `PORT` | Backend server port (default: 5000) |
| `NODE_ENV` | `development` or `production` |
| `FRONTEND_URL` | Frontend origin for CORS |
| `MONGO_URI` | MongoDB connection string |
| `SMTP_HOST` | Email SMTP host (e.g. smtp.gmail.com) |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail App Password (16 characters) |
| `ADMIN_JWT_SECRET` | Long random string for signing admin JWTs |
| `ADMIN_USERNAME` | Admin account username (used by seed script) |
| `ADMIN_PASSWORD` | Admin account password (used by seed script) |

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
