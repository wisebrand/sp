const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../utils/supabase');
const { generateToken, authMiddleware } = require('../utils/jwt');
const { generateOTP, sendOTPEmail } = require('../utils/email');

// Store OTP temporarily (in production, use Redis or database)
const otpStore = new Map();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store OTP temporarily
    otpStore.set(email, { otp, expiresAt: otpExpiry, name, password });

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp);
    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }

    res.json({ message: 'OTP sent to email', email });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }

    const storedData = otpStore.get(email);
    if (!storedData) {
      return res.status(400).json({ error: 'OTP not found or expired' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'OTP expired' });
    }

    // Create user
    const user = new User({
      name: storedData.name,
      email,
      password: storedData.password,
      isVerified: true
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Clean up
    otpStore.delete(email);

    res.json({
      message: 'Email verified and account created',
      user: { id: user._id, name: user.name, email: user.email },
      token
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const storedData = otpStore.get(email);
    if (!storedData) {
      return res.status(400).json({ error: 'No registration in progress' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 5 * 60 * 1000;

    otpStore.set(email, { ...storedData, otp, expiresAt: otpExpiry });

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp);
    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to send OTP email' });
    }

    res.json({ message: 'OTP resent successfully' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      user: { id: user._id, name: user.name, email: user.email },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
