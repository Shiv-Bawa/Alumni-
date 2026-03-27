// Client -> Validation -> Controller -> Database


const { body, validationResult } = require('express-validator');

const VALID_POSITIONS = [
  'President', 'General Secretary', 'Joint Secretary',
  'Treasurer', 'Co-Treasurer', 'Executive Council Member',
];



// Pull validation errors and return 422 if any
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().reduce((acc, e) => { acc[e.path] = e.msg; return acc; }, {}),
    });
  }
  next();
};



// Nomination rules
const validateNomination = [
  body('positionsApplied')
  .notEmpty().withMessage('Position is required.')
  .custom((value) => {
    if (Array.isArray(value)) {
      throw new Error('Only one position can be selected.');
    }
    if (typeof value !== 'string') {
      throw new Error('Invalid position selected.');
    }
    if (!VALID_POSITIONS.includes(value.trim())) {
      throw new Error('Invalid position selected.');
    }
    return true;
  }),
  

  body('candidateDetails.fullName').
  trim().notEmpty().
  withMessage('Full name is required.').
  isLength({ max: 100 }),


  body('candidateDetails.rollNumber').
  trim().
  notEmpty().
  withMessage('Roll number is required.')
  .isLength({ max: 30 }),


  body('candidateDetails.yearOfPassingOut')
    .notEmpty().withMessage('Year of passing is required.')
    .isInt({ 
      min: 1960, 
      max: new Date().getFullYear() + 5 
    })
    .withMessage('Enter a valid year.'),


  body('candidateDetails.branch')
  .trim()
  .notEmpty()
  .withMessage('Branch is required.'),


  body('candidateDetails.email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    
    .isEmail()
    .normalizeEmail()
    .withMessage('Enter a valid email address.'),


  body('candidateDetails.mobile')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required.')
    .matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit Indian mobile number.'),


  body('candidateDetails.currentCity')
  .trim().
  notEmpty()
  .withMessage('Current city is required.'),



  body('candidateDetails.currentCountry')
  .trim()
  .notEmpty()
  .withMessage('Current country is required.'),


  body('candidateDetails.company')
  .trim()
  .notEmpty()
  .withMessage('Company / Occupation is required.'),
  
  body('candidateDetails.designation')
  .trim()
  .notEmpty()
  .withMessage('Designation is required.'),


  body('paymentDetails.transactionNumber')
  .trim()
  .notEmpty()
  .withMessage('Transaction number is required.'),


  body('declarationAccepted')
   .custom((v) => v === 'true' || v === true).withMessage('Declaration must be accepted.'),

  handleValidationErrors,
];

// OTP verify  
const validateOTP = [
  body('nominationId')
  .trim()
  .notEmpty()
  .withMessage('Nomination ID is required.'),


  body('otp')
    .trim().notEmpty().withMessage('OTP is required.')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits.')
    .isNumeric().withMessage('OTP must be numeric.'),
  handleValidationErrors,
];

module.exports = { validateNomination, validateOTP };