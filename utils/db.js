const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function connectMongo() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sd-shopping';
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in .env');
  }

  mongoose.set('strictQuery', false);
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  console.log('✅ Connected to MongoDB');
}

module.exports = connectMongo;
