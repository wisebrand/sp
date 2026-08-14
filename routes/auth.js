const express = require('express');
const router = express.Router();
const { generateToken, authMiddleware } = require('../utils/jwt');
const { generateOTP, sendOTPEmail } = require('../utils/email');
const User = require('../models/User');
const Otp = require('../models/Otp');

// In-memory persistent maps for OTPs and Users when DB is connecting or offline
const pendingOtps = new Map();
const memoryUsers = new Map();

// 1. Send OTP Registration Route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if verified account already exists in memory or MongoDB
    let existingUser = memoryUsers.get(normalizedEmail);
    if (!existingUser) {
      try {
        existingUser = await User.findOne({ email: normalizedEmail }).maxTimeMS(1500);
      } catch (dbErr) {}
    }

    if (existingUser && existingUser.isVerified) {
      return res.status(409).json({ error: 'An account with this email is already registered. Please sign in.' });
    }

    const otp = generateOTP();

    // Store in-memory fallback
    pendingOtps.set(normalizedEmail, { name: name.trim(), email: normalizedEmail, password, otp, createdAt: new Date() });

    // Store in MongoDB Otp collection if available
    try {
      await Otp.deleteMany({ email: normalizedEmail }).maxTimeMS(1500);
      await Otp.create({ email: normalizedEmail, name: name.trim(), password, otp });
    } catch (otpDbErr) {}

    // Send email via HTTPS API or Gmail SSL/TLS transporter
    const emailResult = await sendOTPEmail(normalizedEmail, otp);

    console.log(`\n========================================`);
    console.log(`🔑 [OTP Code Generated for ${normalizedEmail}]: ${otp}`);
    console.log(`✉️ [Email Delivery Status]: ${emailResult.success ? 'Delivered successfully via ' + emailResult.method : 'Failed: ' + emailResult.error}`);
    console.log(`========================================\n`);

    if (!emailResult.success) {
      return res.status(502).json({
        error: `Could not deliver verification email to ${normalizedEmail}. ${emailResult.error || 'Please check your email address or try again.'}`
      });
    }

    res.json({
      message: 'Verification code sent to your email address',
      email: normalizedEmail
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// 2. Verify OTP & Complete Account Creation
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and 6-digit OTP code are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();
    let storedOtp = pendingOtps.get(normalizedEmail);

    // Check DB if not in memory
    if (!storedOtp) {
      try {
        storedOtp = await Otp.findOne({ email: normalizedEmail }).maxTimeMS(1500);
      } catch (dbErr) {}
    }

    if (!storedOtp || storedOtp.otp !== cleanOtp) {
      return res.status(400).json({ error: 'Invalid or expired OTP code. Please check your email or click Resend OTP.' });
    }

    // Create or update verified user in MongoDB
    let user = null;
    try {
      user = await User.findOne({ email: normalizedEmail }).maxTimeMS(1500);
      if (user) {
        user.name = storedOtp.name;
        user.password = storedOtp.password;
        user.isVerified = true;
        await user.save();
      } else {
        user = await User.create({
          name: storedOtp.name,
          email: storedOtp.email,
          password: storedOtp.password,
          isVerified: true
        });
      }
      await Otp.deleteMany({ email: normalizedEmail }).catch(() => {});
    } catch (userDbErr) {
      user = { _id: 'user_' + Date.now(), name: storedOtp.name, email: storedOtp.email };
    }

    // Persist in memory store for instant zero-latency login
    memoryUsers.set(normalizedEmail, {
      _id: user._id || 'user_' + Date.now(),
      name: storedOtp.name,
      email: normalizedEmail,
      password: storedOtp.password,
      isVerified: true
    });

    pendingOtps.delete(normalizedEmail);

    const token = generateToken(user);
    res.json({
      message: 'Account verified and created successfully! Welcome to SD Shopping.',
      user: { id: user._id, name: user.name, email: user.email },
      token
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// 3. Resend OTP Route
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otp = generateOTP();

    let stored = pendingOtps.get(normalizedEmail);
    if (stored) {
      stored.otp = otp;
      stored.createdAt = new Date();
    } else {
      pendingOtps.set(normalizedEmail, { name: 'User', email: normalizedEmail, password: 'password', otp, createdAt: new Date() });
    }

    // Update MongoDB Otp document if available
    try {
      await Otp.deleteMany({ email: normalizedEmail }).maxTimeMS(1500);
      await Otp.create({ email: normalizedEmail, name: stored ? stored.name : 'User', password: stored ? stored.password : 'password', otp });
    } catch (e) {}

    const emailResult = await sendOTPEmail(normalizedEmail, otp);

    console.log(`\n========================================`);
    console.log(`🔑 [RESENT OTP Code for ${normalizedEmail}]: ${otp}`);
    console.log(`✉️ [Email Delivery Status]: ${emailResult.success ? 'Delivered successfully via ' + emailResult.method : 'Failed: ' + emailResult.error}`);
    console.log(`========================================\n`);

    if (!emailResult.success) {
      return res.status(502).json({
        error: `Could not resend verification email to ${normalizedEmail}. ${emailResult.error || 'Connection timed out on host.'}`
      });
    }

    res.json({
      message: 'Verification code resent to your email address',
      email: normalizedEmail
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// 4. Login with 2FA Email OTP Verification
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = null;

    try {
      user = await User.findOne({ email: normalizedEmail }).maxTimeMS(1500);
    } catch (dbErr) {}

    // Check MongoDB user
    if (user) {
      const isValid = await user.comparePassword(password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password. Please try again.' });
      }
    } else {
      // Check in-memory store
      const memUser = memoryUsers.get(normalizedEmail);
      if (memUser && memUser.password === password) {
        user = memUser;
      } else {
        return res.status(401).json({ error: 'No account found with this email. Please check your credentials or sign up.' });
      }
    }

    // Generate 2FA Login OTP
    const otp = generateOTP();

    // Store in-memory
    pendingOtps.set(normalizedEmail, {
      name: user.name,
      email: normalizedEmail,
      password: user.password,
      otp,
      isLogin: true,
      createdAt: new Date()
    });

    // Store in MongoDB Otp collection if available
    try {
      await Otp.deleteMany({ email: normalizedEmail }).maxTimeMS(1500);
      await Otp.create({ email: normalizedEmail, name: user.name, password: user.password, otp });
    } catch (e) {}

    // Send 2FA login verification email
    const emailResult = await sendOTPEmail(normalizedEmail, otp);

    console.log(`\n========================================`);
    console.log(`🔑 [2FA Login OTP Code for ${normalizedEmail}]: ${otp}`);
    console.log(`✉️ [Email Delivery Status]: ${emailResult.success ? 'Delivered successfully via ' + emailResult.method : 'Failed: ' + emailResult.error}`);
    console.log(`========================================\n`);

    if (!emailResult.success) {
      return res.status(502).json({
        error: `Could not deliver login verification email to ${normalizedEmail}. ${emailResult.error || 'Please try again.'}`
      });
    }

    res.json({
      requireOtp: true,
      message: 'Login verification code sent to your email address',
      email: normalizedEmail
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login verification failed' });
  }
});

// 5. Get User Profile Route
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name email createdAt').maxTimeMS(1500);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.json({ id: req.userId, name: 'Active User', email: 'user@example.com' });
  }
});

module.exports = router;
