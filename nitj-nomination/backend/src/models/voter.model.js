const mongoose = require('mongoose');

const VoterSchema = new mongoose.Schema({
  fullName:      { type: String, required: true, trim: true, maxlength: 100 },
  rollNumber:    { type: String, required: true, trim: true, maxlength: 30  },
  yearOfPassing: { type: Number, required: true, min: 1960, max: 2100       },
  branch:        { type: String, required: true, trim: true, maxlength: 100 },
  email:         { type: String, required: true, trim: true, lowercase: true, unique: true },
  mobile:        { type: String, required: true, trim: true, maxlength: 15  },
  cityCountry:   { type: String, required: true, trim: true, maxlength: 200 },
  company:       { type: String, required: true, trim: true, maxlength: 200 },
  designation:   { type: String, required: true, trim: true, maxlength: 200 },

  // OTP
  otpHash:              { type: String, select: false },
  otpExpiry:            { type: Date,   select: false },
  otpAttempts:          { type: Number, default: 0,   select: false },
  otpRequestCount:      { type: Number, default: 0,   select: false },
  otpRequestWindowStart:{ type: Date,                 select: false },

  // Status
  emailVerified: { type: Boolean, default: false },
  hasVoted:      { type: Boolean, default: false },
  votedAt:       { type: Date },

  // Security
  registrationIp: { type: String },
  votingIp:       { type: String },

}, { timestamps: true });

module.exports = mongoose.model('Voter', VoterSchema);
