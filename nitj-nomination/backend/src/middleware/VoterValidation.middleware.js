const { body, validationResult } = require('express-validator');

const handle = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array().map(e => e.msg) });
  }
  next();
};

const validateVoterRegistration = [
  body('fullName')
  .trim()
  .notEmpty()
  .withMessage('Full name is required.')
  .isLength({ max: 100 }),

  body('rollNumber')
  .trim().notEmpty().
  withMessage('Roll number is required.'),

  body('yearOfPassing')
  .isInt({ min: 1960, max: 2100 })
  .withMessage('Enter a valid year of passing.'),

  body('branch')
  .trim().
  notEmpty().
  withMessage('Branch is required.'),
  
  body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Enter a valid email address.'),
  
  body('mobile')
  .trim()
  .isMobilePhone()
  .withMessage('Enter a valid mobile number.'),
  
  body('cityCountry')
  .trim()
  .notEmpty()
  .withMessage('City and country are required.'),
  
  body('company')
  .trim()
  .notEmpty()
  .withMessage('Company/Occupation is required.'),
  
  body('designation')
  .trim().notEmpty()
  .withMessage('Designation is required.'),
  
  handle,
];

const validateVoterOTP = [

  body('voterId')
  .isMongoId()
  .withMessage('Invalid voter ID.'),
  
  body('otp')
  .isLength({ min: 4, max: 4 })
  .isNumeric()
  .withMessage('OTP must be a 4-digit number.'),
  
  handle,
];

const validateVoteSubmission = [
  
  body('voterId')
  .isMongoId()
  .withMessage('Invalid voter ID.'),
  
  body('presidentCandidateId')
  .isMongoId()
  .withMessage('Select a President candidate.'),
  
  body('generalSecretaryCandidateId')
  .isMongoId()
  .withMessage('Select a General Secretary candidate.'),
  
  body('treasurerCandidateId')
  .isMongoId()
  .withMessage('Select a Treasurer candidate.'),
  
  body('coTreasurerCandidateId')
  .isMongoId()
  .withMessage('Select a Co-Treasurer candidate.'),
  
  body('executiveMemberIds')
    .isArray({ min: 1, max: 8 })
    .withMessage('Select between 1 and 8 Executive Council Members.')
    .custom((arr) => arr.every(id => /^[a-f\d]{24}$/i.test(id)))
    .withMessage('Invalid candidate ID in executive members list.'),
  handle,
];

module.exports = { validateVoterRegistration, validateVoterOTP, validateVoteSubmission };