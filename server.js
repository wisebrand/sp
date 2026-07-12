const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const dns = require('node:dns/promises');
const Product = require('./models/Product');

dotenv.config();

dns.setServers(['1.1.1.1', '8.8.8.8']);

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
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

function isInvalidMongoUri(uri) {
  if (!uri) return true;

  const placeholderPatterns = [
    /username/i,
    /password/i,
    /cluster0\.xxxxx/i,
    /your[-_]?password/i,
    /your[-_]?gmail/i,
    /example\.mongodb\.net/i,
  ];
  return placeholderPatterns.some((pattern) => pattern.test(uri));
}

if (!MONGODB_URI || isInvalidMongoUri(MONGODB_URI)) {
  console.error('MongoDB connection failed: invalid MongoDB URI in .env');
  console.error('Please update MONGODB_URI in .env to a real Atlas URI or a running local MongoDB instance.');
  console.error('Example Atlas URI: mongodb+srv://myUser:myPassword@cluster0.abcd123.mongodb.net/sd-shopping?retryWrites=true&w=majority');
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
  ];
  return !user || !pass || placeholderPatterns.some((pattern) => pattern.test(user) || pattern.test(pass));
}

if (isInvalidGmailCredentials(GMAIL_USER, GMAIL_PASS)) {
  console.error('Gmail credentials invalid: please update GMAIL_USER and GMAIL_PASS in .env');
  console.error('1. Enable 2FA on your Gmail account');
  console.error('2. Generate App Password: https://myaccount.google.com/apppasswords');
  console.error('3. Use your Gmail email and the 16-character app password');
  process.exit(1);
}

// Seed products
const seedProducts = async () => {
  const count = await Product.countDocuments();
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
      price: 89.99,
      image: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=400&q=80',
      category: 'Electronics',
      inventory: 75,
      sku: 'SD-WATCH-002',
    },
    {
      title: 'Modern Backpack',
      description: 'Durable backpack with padded laptop sleeve.',
      price: 59.99,
      image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      category: 'Fashion',
      inventory: 50,
      sku: 'SD-BPACK-003',
    },
    {
      title: 'Portable Speaker',
      description: 'Bluetooth speaker with deep bass and splash resistance.',
      price: 39.99,
      image: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?auto=format&fit=crop&w=400&q=80',
      category: 'Electronics',
      inventory: 65,
      sku: 'SD-SPEAKER-004',
    },
    {
      title: 'Coffee Maker',
      description: 'Programmable coffee maker with thermal carafe.',
      price: 79.99,
      image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=400&q=80',
      category: 'Home',
      inventory: 30,
      sku: 'SD-COFFEE-005',
    },
    {
      title: 'Yoga Mat',
      description: 'Non-slip yoga mat with carrying strap.',
      price: 29.99,
      image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=400&q=80',
      category: 'Sports',
      inventory: 100,
      sku: 'SD-YOGA-006',
    },
  ];

  await Product.create(sampleProducts);
  console.log('Sample products seeded');
};

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 30000,
    });

    console.log('MongoDB connected');
    await seedProducts();
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Another instance may already be running.`);
    } else {
      console.error('Server failed to start:', error.message);
    }
  });
};

startServer();
