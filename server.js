const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

// Validate Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase configuration is missing!');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
  console.error('\nGet these from: https://app.supabase.com → Settings → API');
  process.exit(1);
}

// Validate JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-here') {
  console.error('JWT_SECRET is missing or invalid: please update JWT_SECRET in .env');
  console.error('Generate a strong secret using: openssl rand -base64 32');
  process.exit(1);
}

// Validate Gmail credentials
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

function isInvalidGmailCredentials(user, pass) {
  const placeholderPatterns = [
    /your[-_]?gmail/i,
    /your[-_]?16[-_]?character/i,
    /your[-_]?app[-_]?password/i,
    /example/i,
    /placeholder/i,
    /devmail@local/i,
    /abcdefghijklmnop/i,
  ];
  return !user || !pass || placeholderPatterns.some((pattern) => pattern.test(user) || pattern.test(pass));
}

if (isInvalidGmailCredentials(GMAIL_USER, GMAIL_PASS)) {
  console.warn('⚠️  Gmail credentials are not configured. OTP emails will not be sent.');
  console.warn('To enable OTP:');
  console.warn('1. Enable 2FA on your Gmail account');
  console.warn('2. Generate App Password: https://myaccount.google.com/apppasswords');
  console.warn('3. Update GMAIL_USER and GMAIL_PASS in .env\n');
}
  if (count > 0) {
    return;
  }

  const sampleProducts = [
    {
      title: 'Wireless Earbuds',
      description: 'High-quality wireless earbuds with noise cancellation.',
      price: 49.99,
      image: 'https://images.unsplash.com/photo-1518444028199-e180e7d2f217?auto=format&fit=crop&w=400&q=80',
      category: 'Electronics',
      inventory: 120,
      sku: 'SD-EARBUDS-001',
    },
    {
      title: 'Smart Watch',
      description: 'Fitness tracking smart watch with heart rate monitoring.',

// Start server
const startServer = () => {
  const server = app.listen(PORT, () => {
    console.log(`\n✅ SD Shopping Server is running!`);
    console.log(`📱 Open http://localhost:${PORT} in your browser\n`);
    console.log(`Database: Supabase (PostgreSQL)`);
    console.log(`API Health: http://localhost:${PORT}/api/health\n`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use`);
      console.error('Kill the process or use a different PORT in .env');
    } else {
      console.error('Server failed to start:', error.message);
    }
    process.exit(1);
  });
};

console.log(`\n🚀 Starting SD Shopping Server...\n`);
startServer();

