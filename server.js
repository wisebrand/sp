const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectMongo = require('./utils/db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectMongo();
    app.listen(PORT, () => {
      console.log(`\n✅ SD Shopping Server is running on http://localhost:${PORT}`);
      console.log('MongoDB connected successfully');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
