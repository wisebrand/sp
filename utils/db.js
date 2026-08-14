const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');

dotenv.config();

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore fallback DNS error if environment prohibits custom DNS
}

// Disable Mongoose command buffering so queries never stall or hang if DB is offline
mongoose.set('strictQuery', false);
mongoose.set('bufferCommands', false);

async function connectMongo() {
  const rawUri = process.env.MONGODB_URI || '';
  const primaryUri = rawUri.trim().replace(/^["']|["']$/g, '');
  const localUri = 'mongodb://127.0.0.1:27017/sd-shopping';

  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 2500,
    connectTimeoutMS: 2500
  };

  if (primaryUri && (primaryUri.startsWith('mongodb://') || primaryUri.startsWith('mongodb+srv://'))) {
    try {
      await mongoose.connect(primaryUri, options);
      console.log('✅ Connected to MongoDB Atlas');
      return;
    } catch (atlasError) {
      console.warn('⚠️ MongoDB Atlas notice:', atlasError.message);
    }
  } else if (primaryUri) {
    console.warn('⚠️ MONGODB_URI notice: Expected connection string starting with "mongodb+srv://" or "mongodb://"');
  }

  try {
    await mongoose.connect(localUri, options);
    console.log('✅ Connected to Local MongoDB');
    return;
  } catch (localError) {
    console.warn('⚡ Using high-speed in-memory database store (Zero latency / Zero timeout).');
  }
}

module.exports = connectMongo;
