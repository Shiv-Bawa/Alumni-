# 🎓 NITJ Alumni Election – Nomination System

Nomination-only system for NIT Jalandhar Alumni Election.  
**No voting. No proposer. Just the nomination form + OTP email verification.**

---

## 📁 Folder Structure

```
nitj-nomination/
│
├── backend/                         ← Node.js + Express + MongoDB
│   ├── server.js                    ← Entry point
│   ├── package.json
│   ├── .env.example                 ← Copy to .env and fill in
│   ├── uploads/                     ← Uploaded files (auto-created)
│   └── src/
│       ├── config/
│       │   ├── database.js          ← MongoDB connection
│       │   └── multer.js            ← File upload (5MB, PDF/JPG/PNG)
│       ├── controllers/
│       │   └── nomination.controller.js  ← submit / verify-otp / resend-otp
│       ├── middleware/
│       │   ├── error.middleware.js
│       │   ├── rateLimit.middleware.js
│       │   └── validation.middleware.js
│       ├── models/
│       │   └── nomination.model.js  ← Mongoose schema
│       ├── routes/
│       │   └── nomination.routes.js
│       └── services/
│           ├── email.service.js     ← Nodemailer (OTP + confirmation)
│           └── otp.service.js       ← Generate / hash / verify OTP
│
└── frontend/                        ← Plain HTML + CSS + JS (no framework)
    ├── index.html                   ← Nomination form
    ├── style.css                    ← NITJ maroon theme
    └── app.js                       ← Form logic + OTP flow
```

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

## 📡 API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/nomination/submit` | Submit form + files → sends OTP |
| `POST` | `/api/nomination/verify-otp` | Verify OTP → confirm nomination |
| `POST` | `/api/nomination/resend-otp` | Resend OTP |
| `GET`  | `/api/health` | Health check |

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

---

## 📧 Flow

```
1. Candidate fills form (5 sections, 2 file uploads)
2. Clicks "Submit & Get OTP"
3. Backend validates all fields + files
4. Saves nomination as pending_otp
5. Sends OTP email (bcrypt-hashed OTP stored)
6. Candidate enters OTP in modal
7. Backend verifies hash + checks expiry
8. Status → submitted, OTP fields cleared
9. Confirmation email sent
10. Success overlay shown with Nomination ID
```