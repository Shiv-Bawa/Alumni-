const jwt        = require('jsonwebtoken');
const Admin      = require('../models/admin.model');
const Nomination = require('../models/nomination.model');
const Voter      = require('../models/voter.model');
const { Vote, VoteExecMember } = require('../models/vote.model');

// ── Login ─────────────────────────────────────────────────────────────────────
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required.' });
    }
    const admin = await Admin.findOne({ username }).select('+passwordHash');
    if (!admin || !(await admin.verifyPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    const token = jwt.sign({ adminId: admin._id, role: 'admin' }, process.env.ADMIN_JWT_SECRET, { expiresIn: '8h' });
    return res.status(200).json({ success: true, token, admin: { id: admin._id, username: admin.username } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Dashboard Summary ─────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const [totalNom, pendingNom, approvedNom, rejectedNom, totalVoters, totalVotes] = await Promise.all([
      Nomination.countDocuments({ status: { $in: ['pending_admin', 'approved', 'rejected'] } }),
      Nomination.countDocuments({ status: 'pending_admin' }),
      Nomination.countDocuments({ status: 'approved' }),
      Nomination.countDocuments({ status: 'rejected' }),
      Voter.countDocuments({ emailVerified: true }),
      Vote.countDocuments(),
    ]);
    return res.status(200).json({
      success: true,
      summary: { totalNom, pendingNom, approvedNom, rejectedNom, totalVoters, totalVotes },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Get All Nominations ───────────────────────────────────────────────────────
const getNominations = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    else filter.status = { $in: ['pending_admin', 'approved', 'rejected'] };
    const nominations = await Nomination.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, nominations });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Review a Nomination ───────────────────────────────────────────────────────
const reviewNomination = async (req, res) => {
  try {
    const { nominationId } = req.params;
    const { action, remarks } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be approve or reject.' });
    }
    const nom = await Nomination.findOne({ nominationId });
    if (!nom) return res.status(404).json({ success: false, message: 'Nomination not found.' });
    if (nom.status === 'pending_otp') {
      return res.status(400).json({ success: false, message: 'This nomination has not been email-verified yet.' });
    }

    nom.status          = action === 'approve' ? 'approved' : 'rejected';
    nom.adminRemarks    = remarks || '';
    nom.adminReviewedAt = new Date();
    await nom.save();

    return res.status(200).json({
      success: true,
      message: `Nomination ${nom.status} successfully.`,
      status:  nom.status,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── Election Results (admin only) ─────────────────────────────────────────────
const getResults = async (req, res) => {
  try {
    const totalVotes = await Vote.countDocuments();

    const posFields = [
      { field: 'presidentId',        label: 'President'         },
      { field: 'generalSecretaryId', label: 'General Secretary' },
      { field: 'treasurerId',        label: 'Treasurer'         },
      { field: 'coTreasurerId',      label: 'Co-Treasurer'      },
    ];

    const results = {};

    for (const { field, label } of posFields) {
      results[label] = await Vote.aggregate([
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
        { $lookup: { from: 'nominations', localField: '_id', foreignField: '_id', as: 'nom' } },
        { $unwind: { path: '$nom', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id:          0,
            candidateId:  '$_id',
            nominationId: { $ifNull: ['$nom.nominationId', 'Unknown'] },
            fullName:     { $ifNull: ['$nom.candidate.fullName',  'Unknown'] },
            branch:       { $ifNull: ['$nom.candidate.branch',    ''] },
            company:      { $ifNull: ['$nom.candidate.company',   ''] },
            voteCount:    '$count',
          },
        },
      ]);
    }

    results['Executive Council Member'] = await VoteExecMember.aggregate([
      { $group: { _id: '$candidateId', count: { $sum: 1 } } },
      { $sort:  { count: -1 } },
      { $lookup: { from: 'nominations', localField: '_id', foreignField: '_id', as: 'nom' } },
      { $unwind: { path: '$nom', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id:          0,
          candidateId:  '$_id',
          nominationId: { $ifNull: ['$nom.nominationId', 'Unknown'] },
          fullName:     { $ifNull: ['$nom.candidate.fullName',  'Unknown'] },
          branch:       { $ifNull: ['$nom.candidate.branch',    ''] },
          company:      { $ifNull: ['$nom.candidate.company',   ''] },
          voteCount:    '$count',
        },
      },
    ]);

    return res.status(200).json({ success: true, totalVotes, results });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { adminLogin, getDashboard, getNominations, reviewNomination, getResults };
