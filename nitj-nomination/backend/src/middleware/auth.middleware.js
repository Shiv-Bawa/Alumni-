const jwt = require('jsonwebtoken');

const requireAdmin = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.ADMIN_JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Not admin');
    req.admin = decoded;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Session expired.' : 'Invalid token.';
    return res.status(401).json({ success: false, message: msg });
  }
};

module.exports = { requireAdmin };
