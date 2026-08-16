const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectMongo = require('./utils/db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');

dotenv.config();

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.static(path.join(__dirname)));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

const mongoose = require('mongoose');

app.get('/api/health', (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatusMap[mongoState] || 'in-memory-fallback',
      connected: mongoState === 1
    },
    memoryUsage: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
    }
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Express error:', err.stack || err.message);
  res.status(err.status || 400).json({ error: err.message || 'Invalid request format' });
});

const PORT = process.env.PORT || 5000;
let serverInstance = null;

async function startServer() {
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ SD Shopping Server is running on http://localhost:${PORT}`);
  });
  connectMongo().catch(err => console.warn('Mongo connection notice:', err.message));
}

// Graceful shutdown handling
function handleGracefulShutdown(signal) {
  console.log(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);
  if (serverInstance) {
    serverInstance.close(async () => {
      console.log('🛑 HTTP server closed.');
      try {
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
          console.log('🛑 MongoDB connection closed.');
        }
      } catch (err) {
        console.error('Error closing DB connection:', err);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

startServer();
