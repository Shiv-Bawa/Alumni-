const mongoose = require('mongoose');

// Stores each submitted ballot
const VoteSchema = new mongoose.Schema(
  {
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voter',
      required: true,
      unique: true,  //one vote for one 
      index: true,
    },

    // Single-selection positions
    presidentCandidateId:        {
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Nomination', 
      required: true 
    },

    generalSecretaryCandidateId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Nomination', 
      required: true 
    },

    treasurerCandidateId:        { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Nomination', 
      required: true 
    },

    coTreasurerCandidateId:      { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Nomination', 
      required: true 
    },

    submittedIp: { type: String },
  },
  { timestamps: true }
);

// Executive council selections (up to 8) — stored separately
const VoteExecutiveMemberSchema = new mongoose.Schema({
  voteId:      { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vote', 
    required: true, 
    index: true 
  },

  candidateId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Nomination', 
    required: true 
  },
});

// FIX: prevent duplicate candidate selection in same vote
VoteExecutiveMemberSchema.index({ voteId: 1, candidateId: 1 }, { unique: true });

const Vote = mongoose.model('Vote', VoteSchema);
const VoteExecutiveMember = mongoose.model('VoteExecutiveMember', VoteExecutiveMemberSchema);



module.exports = { Vote, VoteExecutiveMember };