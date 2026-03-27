const notFound = (req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });


const globalErrorHandler = (err, req, res, _next) => {
  // Multer
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5 MB.' });
  if (err.code === 'LIMIT_FILE_COUNT')
    return res.status(400).json({ success: false, message: 'Too many files uploaded.' });
  if (err.message?.includes('Invalid file type'))
    return res.status(400).json({ success: false, message: err.message });

  // MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A confirmed nomination from this email already exists.',
    });
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    );
    return res.status(422).json({ success: false, message: 'Validation failed.', errors });
  }

  console.error('[ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
};

module.exports = { notFound, globalErrorHandler };
