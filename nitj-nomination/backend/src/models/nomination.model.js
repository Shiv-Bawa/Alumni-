const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const VALID_POSITIONS = [
  'President',
  'General Secretary',
  'Joint Secretary',
  'Treasurer',
  'Co-Treasurer',
  'Executive Council Member',
];

const NominationSchema = new mongoose.Schema(
  {
    // Unique nomination ID 
    nominationId: {
      type:    String,
      default: () => `NITJ-${uuidv4().slice(0, 8).toUpperCase()}`,
      unique:  true, 
    },

    // Section 1: Positions 
    positionsApplied: {
      type: [String], // Updated to array to allow multiple selections per PDF 
      enum: VALID_POSITIONS,
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one position must be selected.',
      },
    },

    // Section 2: Candidate Details
    candidateDetails: {
      fullName:{
        type: String, 
        required: true, 
        trim: true, 
        maxlength: 100 
      },

      rollNumber:{ 
        type: String, 
        required: true, 
        trim: true, 
        maxlength: 30  
      },
      yearOfPassingOut:{ 
        type: Number, 
        required: true, 
        min: 1960, 
        max: 2100       
      },
      branch:{ 
        type: String, 
        required: true, 
        trim: true, 
        maxlength: 100 
      },
      email:{ 
        type: String, 
        required: true, 
        trim: true, 
        lowercase: true 
      },
      mobile:{ 
        type: String, 
        required: true, 
        trim: true         
      },
      currentCity:{ 
        type: String, 
        required: true, 
        trim: true, 
        maxlength: 100 
      },
      currentCountry:{ 
        type: String, 
        required: true, 
        trim: true, 
        maxlength: 100 
      },
      company:{ 
        type: String, 
        required: true, 
        trim: true, 
        maxlength: 200 
      },
      designation:{ 
        type: String, 
        required: true, 
        trim: true, 
        maxlength: 200 
      },
    },

    // payment 
    paymentDetails: {
      transactionNumber:{ 
        type: String, 
        required: true, 
        trim: true, 
        maxlength: 100 
      },
      paymentScreenshotPath:{ 
        type: String, 
        required: true
      },
    },

    // proof of association
    proofOfAssociationPath: { 
      type: String, 
      required: true
    },

    // declaration
    declarationAccepted: {
      type:     Boolean,
      required: true,
      validate: { validator: (v) => v === true, message: 'Declaration must be accepted.' },
    },

    // security of otp
    isEmailVerified:{ 
      type: Boolean, 
      default: false 
    },
    otpHash:{ 
      type: String,  
      select: false   
    },
    otpExpiry:{ 
      type: Date,    
      select: false   
    },
    otpAttempts:{ 
      type: Number,  
      default: 0, 
      select: false 
    },

    // --- REQUIRED CHANGES FOR ADMIN & RESULTS ---
    isAdminVerified: { 
      type: Boolean, 
      default: false 
    },
    votes: { 
      type: Number, 
      default: 0 
    },
    // --------------------------------------------

    // Status
    status: {
      type:    String,
      enum:    ['pending_otp', 'submitted', 'rejected'], // Added 'rejected' for admin use
      default: 'pending_otp',
    },

    submittedAt: { type: Date },
  },
  { timestamps: true }
);

// one nomination form for one mail
NominationSchema.index(
  { 'candidateDetails.email': 1 },
  {
    unique:                  true,
    partialFilterExpression: { status: 'submitted' },
    name:                    'unique_submitted_email',
  }
);

module.exports = mongoose.model('Nomination', NominationSchema);