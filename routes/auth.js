const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { generateToken, authMiddleware } = require('../utils/jwt');
const { generateOTP, sendOTPEmail } = require('../utils/email');
const User = require('../models/User');

const otpStore = new Map();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore.set(email.toLowerCase(), { name, email, password, otp, expiresAt });

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

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const stored = otpStore.get(email.toLowerCase());
    if (!stored || stored.otp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return res.status(400).json({ error: 'OTP has expired' });
    }

    const user = new User({
      name: stored.name,
      email: stored.email.toLowerCase(),
      password: stored.password,
      isVerified: true
    });

    await user.save();
    otpStore.delete(email.toLowerCase());

    const token = generateToken(user._id);
    res.json({
      message: 'Account created successfully',
      user: { id: user._id, name: user.name, email: user.email },
      token
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const stored = otpStore.get(email.toLowerCase());
    if (!stored) {
      return res.status(400).json({ error: 'No pending verification found for this email' });
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(email.toLowerCase(), { ...stored, otp, expiresAt });

    const emailResult = await sendOTPEmail(email, otp);
    if (!emailResult.success) {
      return res.status(500).json({ error: 'Failed to resend OTP' });
    }

    res.json({ message: 'OTP resent successfully' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Email verification is required' });
    }

    const token = generateToken(user._id);
    res.json({ message: 'Login successful', user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name email createdAt');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
