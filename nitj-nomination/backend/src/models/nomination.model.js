const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const VALID_POSITIONS = [
  'President',
  'General Secretary',
  'Joint Secretary',
  'Treasurer',
  'Co-Treasurer',
  'Executive Council Member',
];

/* Candidate info sub-schema */
const CandidateInfoSchema = new mongoose.Schema({
  fullName:      { type: String, required: true, trim: true, maxlength: 100 },
  rollNumber:    { type: String, required: true, trim: true, maxlength: 30  },
  yearOfPassing: { type: Number, required: true, min: 1960, max: 2100       },
  branch:        { type: String, required: true, trim: true, maxlength: 100 },
  email:         { type: String, required: true, trim: true, lowercase: true },
  mobile:        { type: String, required: true, trim: true, maxlength: 15  },
  cityCountry:   { type: String, required: true, trim: true, maxlength: 200 },
  company:       { type: String, required: true, trim: true, maxlength: 200 },
  designation:   { type: String, required: true, trim: true, maxlength: 200 },
}, { _id: false });

const NominationSchema = new mongoose.Schema({

  nominationId: {
    type:    String,
    default: () => `NITJ-NOM-${uuidv4().slice(0, 8).toUpperCase()}`,
    unique:  true,
  },

  /* Positions — candidate can apply for multiple */
  positions: {
    type:     [String],
    enum:     VALID_POSITIONS,
    required: true,
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message:   'At least one position must be selected.',
    },
  },

  /* Candidate details */
  candidate: { type: CandidateInfoSchema, required: true },

  /* Payment */
  transactionNumber:     { type: String, required: true, trim: true },
  paymentScreenshotPath: { type: String, required: true },

  /* Proof of association (candidate only) */
  candidateProofPath: { type: String, required: true },

  /* Declaration */
  declarationAccepted: {
    type:     Boolean,
    required: true,
    validate: { validator: (v) => v === true, message: 'Declaration must be accepted.' },
  },

  /* OTP */
  otpHash:     { type: String, select: false },
  otpExpiry:   { type: Date,   select: false },
  otpAttempts: { type: Number, default: 0, select: false },

  /* Workflow:
     pending_otp   → form submitted, email not yet verified
     pending_admin → email verified, waiting for admin review
     approved      → admin approved → appears on ballot
     rejected      → admin rejected
  */
  status: {
    type:    String,
    enum:    ['pending_otp', 'pending_admin', 'approved', 'rejected'],
    default: 'pending_otp',
  },

  adminRemarks:    { type: String, trim: true, maxlength: 500 },
  adminReviewedAt: { type: Date },
  submittedAt:     { type: Date },

}, { timestamps: true });

/* One confirmed nomination per candidate email */
NominationSchema.index(
  { 'candidate.email': 1 },
  {
    unique:                  true,
    partialFilterExpression: { status: { $in: ['pending_admin', 'approved', 'rejected'] } },
    name:                    'unique_confirmed_candidate_email',
  }
);

module.exports = mongoose.model('Nomination', NominationSchema);
