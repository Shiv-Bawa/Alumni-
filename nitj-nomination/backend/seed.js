const mongoose = require('mongoose');
const Nomination = require('./src/models/nomination.model');
const Voter = require('./src/models/voter.model');
require('dotenv').config();

const seedData = async () => {
  try {
    // 1. Connect to your local MongoDB
    // Change this line in seed.js
    await mongoose.connect('mongodb://127.0.0.1:27017/nitjNomination');
    console.log("Connected to Database for seeding...");

    // 2. Clear existing test data (Optional - Be careful!)
    await Nomination.deleteMany({});
    await Voter.deleteMany({});

    // 3. Create Dummy Candidates (Some verified, some pending)
    const positions = ['President', 'General Secretary', 'Treasurer', 'Co-Treasurer', 'Executive Council Member'];
    
    const candidates = [];
    for (let i = 1; i <= 15; i++) {
      candidates.push({
        positionsApplied: positions[i % 5],
        candidateDetails: {
          fullName: `Candidate ${i}`,
          email: `candidate${i}@example.com`,
          rollNumber: `2022NITJ${100 + i}`,
          yearOfPassingOut: 2024,
          branch: 'Computer Science',
          mobile: `987654321${i % 10}`,
          currentCity: 'Jalandhar',
          currentCountry: 'India',
          company: 'Tech Corp',
          designation: 'Engineer'
        },
        paymentDetails: {
          transactionNumber: `TXN${1000 + i}`,
          paymentScreenshotPath: 'uploads/dummy_pay.png'
        },
        proofOfAssociationPath: 'uploads/dummy_degree.pdf',
        declarationAccepted: true,
        status: 'submitted',
        isAdminVerified: i % 2 === 0, // Every second candidate is pre-verified for testing
        votes: 0
      });
    }
    await Nomination.insertMany(candidates);
    console.log("✅ 15 Dummy Candidates created (some verified).");

    // 4. Create Eligible Voters (Updated to match your strict Voter Model)
    const voters = [];
    for (let j = 1; j <= 20; j++) {
      voters.push({
        fullName: `Alumnus ${j}`,
        email: `voter${j}@example.com`,
        rollNumber: `2020NITJ${500 + j}`,
        mobile: `99887766${10 + j}`, // Added
        branch: 'Electronics',        // Added
        yearOfPassing: 2020,         // Added
        cityCountry: 'India',        // Added
        company: 'Global Tech',      // Added
        designation: 'Senior Lead',   // Added
        emailVerified: false,
        hasVoted: false
      });
    }
    await Voter.insertMany(voters);
    console.log("✅ 20 Eligible Voters added to Master Dataset.");

    process.exit();
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

seedData();