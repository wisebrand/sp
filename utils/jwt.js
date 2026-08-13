const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key_change_in_production';

// Generate JWT token
function generateToken(userOrId) {
  const payload = typeof userOrId === 'object' && userOrId !== null
    ? { userId: userOrId._id || userOrId.id, name: userOrId.name }
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

// Middleware to authenticate requests
function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.userId = decoded.userId;
    req.userName = decoded.name || decoded.userName;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware
};
