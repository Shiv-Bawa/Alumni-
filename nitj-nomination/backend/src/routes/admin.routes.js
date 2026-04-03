const express = require('express');
const router  = express.Router();
const { adminLogin, getDashboard, getNominations, reviewNomination, getResults } = require('../controllers/admin.controller');
const { requireAdmin } = require('../middleware/auth.middleware');
const { apiLimiter }   = require('../middleware/rateLimit.middleware');

router.use(apiLimiter);

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/login', adminLogin);

// ── Protected (require JWT) ───────────────────────────────────────────────────
router.get('/dashboard', requireAdmin, getDashboard);

// Nominations — view all, approve/reject
router.get('/nominations',                       requireAdmin, getNominations);
router.post('/nominations/:nominationId/review', requireAdmin, reviewNomination);

// Results — visible to admin only
router.get('/results', requireAdmin, getResults);

module.exports = router;
