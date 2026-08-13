const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('dns');

dotenv.config();

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore fallback DNS error if environment prohibits custom DNS
}

async function connectMongo() {
  const primaryUri = process.env.MONGODB_URI;
  const localUri = 'mongodb://127.0.0.1:27017/sd-shopping';

  mongoose.set('strictQuery', false);

  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  };

  if (primaryUri) {
    try {
      await mongoose.connect(primaryUri, options);
      console.log('✅ Connected to MongoDB Atlas');
      return;
    } catch (atlasError) {
      console.warn('⚠️ Could not connect to MongoDB Atlas:', atlasError.message);
      console.warn('   Trying local MongoDB...');
    }
  }

  try {
    await mongoose.connect(localUri, options);
    console.log('✅ Connected to Local MongoDB');
    return;
  } catch (localError) {
    console.warn('⚠️ Could not connect to Local MongoDB. Attempting In-Memory MongoDB fallback...');
  }

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoServer = await Promise.race([
      MongoMemoryServer.create(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('MongoMemoryServer download/startup timed out')), 2000))
    ]);
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, options);
    console.log('✅ Connected to In-Memory MongoDB:', uri);
  } catch (memError) {
    console.warn('⚠️ MongoDB not available:', memError.message);
    console.warn('⚡ Operating in DB-offline fallback mode for products and auth.');
  }
}

module.exports = connectMongo;
