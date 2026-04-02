const mongoose = require('mongoose');

const EligibleVoterSchema = new mongoose.Schema({
  email:         { type: String, required: true, trim: true, lowercase: true },
  fullName:      { type: String, trim: true },
  rollNumber:    { type: String, trim: true },
  yearOfPassing: { type: Number },
  branch:        { type: String, trim: true },
  uploadBatch:   { type: String },          // UUID of the upload session
}, { timestamps: true });

EligibleVoterSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('EligibleVoter', EligibleVoterSchema);
