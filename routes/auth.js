const express = require('express');
const router = express.Router();
const { generateToken, authMiddleware } = require('../utils/jwt');
const { generateOTP, sendOTPEmail } = require('../utils/email');
const User = require('../models/User');
const Otp = require('../models/Otp');
const Order = require('../models/Order');

// Authorized Administrator Accounts
const AUTHORIZED_ADMIN_EMAILS = [
  'mikegborbitey05@gmail.com',
  'mikegborbitey05@gmil.com',
  (process.env.ADMIN_EMAIL || '').toLowerCase().trim()
].filter(Boolean);

function isUserAdmin(email) {
  if (!email) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

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
    const isAdmin = isUserAdmin(normalizedEmail);
    res.json({
      message: 'Account verified and created successfully! Welcome to SD Shopping.',
      user: { id: user._id, name: user.name, email: user.email, isAdmin, role: isAdmin ? 'admin' : 'user' },
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

    // Find user in MongoDB or memory store
    if (!user) {
      const memUser = memoryUsers.get(normalizedEmail);
      if (memUser) {
        user = memUser;
      }
    }

    // 1. Account does not exist (User hasn't signed up yet)
    if (!user) {
      return res.status(404).json({
        code: 'ACCOUNT_NOT_FOUND',
        error: 'No account found with this email address. You haven\'t signed up yet. Please sign up to create an account.'
      });
    }

    // 2. Validate Password
    let isValid = false;
    if (typeof user.comparePassword === 'function') {
      isValid = await user.comparePassword(password);
    } else {
      isValid = (user.password === password);
    }

    if (!isValid) {
      return res.status(401).json({
        code: 'INVALID_PASSWORD',
        error: 'Incorrect password. Please verify your password and try again.'
      });
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
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    let user = null;
    try {
      user = await User.findById(req.userId).select('-password').maxTimeMS(2000);
    } catch (e) {}

    if (!user) {
      for (const [_, u] of memoryUsers.entries()) {
        if (u._id === req.userId || u.id === req.userId || u.email === req.userEmail) {
          user = u;
          break;
        }
      }
    }

    if (!user) {
      user = {
        _id: req.userId,
        name: req.userName || 'Customer',
        email: req.userEmail || 'customer@example.com',
        phone: '',
        address: '',
        city: '',
        isVerified: true,
        createdAt: new Date()
      };
    }

    let orderCount = 0;
    try {
      orderCount = await Order.countDocuments({ userId: req.userId }).maxTimeMS(1500);
    } catch (e) {}

    const isAdmin = isUserAdmin(user.email);
    res.json({
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        city: user.city || '',
        isAdmin,
        role: isAdmin ? 'admin' : 'user',
        isVerified: user.isVerified !== undefined ? user.isVerified : true,
        createdAt: user.createdAt || new Date()
      },
      orderCount
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to load user profile' });
  }
});

// Alias for /me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name email phone address city createdAt isVerified role').maxTimeMS(1500);
    if (!user) {
      const isAdmin = isUserAdmin(req.userEmail);
      return res.json({ id: req.userId, name: req.userName || 'Customer', email: req.userEmail || '', isAdmin, role: isAdmin ? 'admin' : 'user' });
    }
    const isAdmin = isUserAdmin(user.email) || user.role === 'admin';
    res.json({ id: user._id, name: user.name, email: user.email, isAdmin, role: isAdmin ? 'admin' : 'user' });
  } catch (error) {
    const isAdmin = isUserAdmin(req.userEmail);
    res.json({ id: req.userId, name: req.userName || 'Customer', email: req.userEmail || '', isAdmin, role: isAdmin ? 'admin' : 'user' });
  }
});

// 6. Update User Profile Route
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, address, city } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    let updatedUser = null;
    try {
      updatedUser = await User.findByIdAndUpdate(
        req.userId,
        {
          $set: {
            name: name.trim(),
            phone: (phone || '').trim(),
            address: (address || '').trim(),
            city: (city || '').trim()
          }
        },
        { new: true }
      ).select('-password').maxTimeMS(2000);
    } catch (dbErr) {
      console.warn('Profile update MongoDB notice:', dbErr.message);
    }

    if (!updatedUser) {
      for (const [email, u] of memoryUsers.entries()) {
        if (u._id === req.userId || u.id === req.userId || u.email === req.userEmail) {
          u.name = name.trim();
          u.phone = (phone || '').trim();
          u.address = (address || '').trim();
          u.city = (city || '').trim();
          updatedUser = u;
          break;
        }
      }
    }

    if (!updatedUser) {
      updatedUser = {
        _id: req.userId,
        name: name.trim(),
        email: req.userEmail || '',
        phone: phone || '',
        address: address || '',
        city: city || '',
        isVerified: true
      };
    }

    const newToken = generateToken(updatedUser);
    const isAdmin = isUserAdmin(updatedUser.email);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id || updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || '',
        address: updatedUser.address || '',
        city: updatedUser.city || '',
        isAdmin,
        role: isAdmin ? 'admin' : 'user',
        isVerified: updatedUser.isVerified !== undefined ? updatedUser.isVerified : true
      },
      token: newToken
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 7. Change Password Route
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    let user = null;
    try {
      user = await User.findById(req.userId).maxTimeMS(2000);
    } catch (dbErr) {}

    if (user) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect current password. Please try again.' });
      }
      user.password = newPassword;
      await user.save();
    } else {
      let memUser = null;
      for (const [_, u] of memoryUsers.entries()) {
        if (u._id === req.userId || u.id === req.userId || u.email === req.userEmail) {
          memUser = u;
          break;
        }
      }
      if (memUser) {
        if (memUser.password !== currentPassword) {
          return res.status(400).json({ error: 'Incorrect current password' });
        }
        memUser.password = newPassword;
      } else {
        return res.status(404).json({ error: 'User account not found' });
      }
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// 8. Delete All Signed-Up Users (Clean Database for Fresh Signups)
router.post('/clear-users', async (req, res) => {
  try {
    let deletedCount = 0;
    try {
      const userRes = await User.deleteMany({});
      deletedCount = userRes.deletedCount || 0;
      await Otp.deleteMany({});
    } catch (dbErr) {
      console.warn('DB delete notice:', dbErr.message);
    }

    // Also clear in-memory stores
    const memCount = memoryUsers.size;
    memoryUsers.clear();
    pendingOtps.clear();

    console.log(`\n🧹 [Database Cleanup]: Removed ${deletedCount} users from MongoDB and ${memCount} from memory store.`);

    res.json({
      message: 'All registered emails and users have been deleted from the database. New registrations and OTP verification remain fully functional.',
      deletedFromMongo: deletedCount,
      deletedFromMemory: memCount
    });
  } catch (error) {
    console.error('Clear users error:', error);
    res.status(500).json({ error: 'Failed to clear users' });
  }
});

router.memoryUsers = memoryUsers;
module.exports = router;
