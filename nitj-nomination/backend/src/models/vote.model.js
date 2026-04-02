const mongoose = require('mongoose');

// Main vote record — one per voter, enforced by unique index on voterId
const VoteSchema = new mongoose.Schema({
  voterId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Voter',
    required: true,
    unique:   true,   // one vote per voter — DB-level enforcement
  },

  // Single-choice positions
  presidentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Nomination', required: true },
  generalSecretaryId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Nomination', required: true },
  treasurerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Nomination', required: true },
  coTreasurerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Nomination', required: true },

  submittedIp: { type: String },
}, { timestamps: true });

// Executive Council Members — up to 8, stored separately for easy aggregation
const VoteExecMemberSchema = new mongoose.Schema({
  voteId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Vote',       required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nomination', required: true },
});

// Prevent same candidate being selected twice in one vote
VoteExecMemberSchema.index({ voteId: 1, candidateId: 1 }, { unique: true });

const Vote          = mongoose.model('Vote',          VoteSchema);
const VoteExecMember= mongoose.model('VoteExecMember', VoteExecMemberSchema);

module.exports = { Vote, VoteExecMember };
