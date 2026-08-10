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

dotenv.config();

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
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

async function startServer() {
  app.listen(PORT, () => {
    console.log(`\n✅ SD Shopping Server is running on http://localhost:${PORT}`);
  });
  connectMongo();
}

startServer();
