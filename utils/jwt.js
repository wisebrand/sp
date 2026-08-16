const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key_change_in_production';

// Generate JWT token
function generateToken(userOrId) {
  const AUTHORIZED_ADMIN_EMAILS = ['mikegborbitey05@gmail.com', 'mikegborbitey05@gmil.com'];
  const email = (userOrId && userOrId.email ? userOrId.email.toLowerCase().trim() : '');
  const isAdmin = AUTHORIZED_ADMIN_EMAILS.includes(email) || (userOrId && (userOrId.isAdmin || userOrId.role === 'admin'));

  const payload = typeof userOrId === 'object' && userOrId !== null
    ? {
        userId: userOrId._id || userOrId.id,
        name: userOrId.name,
        email: userOrId.email,
        isAdmin: !!isAdmin,
        role: isAdmin ? 'admin' : 'user'
      }
    : { userId: userOrId };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Generate Admin JWT token
function generateAdminToken(adminObj) {
  const payload = {
    adminId: adminObj._id || adminObj.id || 'admin_root',
    name: adminObj.name || 'Store Administrator',
    email: adminObj.email || 'mikegborbitey05@gmail.com',
    role: 'admin',
    isAdmin: true
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Middleware to authenticate requests
function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = decoded.userId;
    req.userName = decoded.name || decoded.userName;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Middleware to authenticate Administrator requests
function adminAuthMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Administrator authentication required. Please log in as Admin.' });
    }

    const decoded = verifyToken(token);
    if (!decoded || (!decoded.isAdmin && decoded.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied: Requires administrator privileges.' });
    }

    req.adminId = decoded.adminId || decoded.userId;
    req.adminName = decoded.name;
    req.adminEmail = decoded.email;
    req.isAdmin = true;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Admin authentication failed' });
  }
}

module.exports = {
  generateToken,
  generateAdminToken,
  verifyToken,
  authMiddleware,
  adminAuthMiddleware
};

