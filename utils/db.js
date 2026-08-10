const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function connectMongo() {
  const primaryUri = process.env.MONGODB_URI;
  const localUri = 'mongodb://127.0.0.1:27017/sd-shopping';

  mongoose.set('strictQuery', false);

  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 15000
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
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, options);
    console.log('✅ Connected to In-Memory MongoDB:', uri);
  } catch (memError) {
    console.error('❌ Could not connect to MongoDB Atlas, Local MongoDB, or In-Memory MongoDB.');
    console.error('   To fix MongoDB Atlas access: Whitelist your current IP at https://cloud.mongodb.com');
    console.error('   To run locally: Ensure local MongoDB service is started (mongod).');
  }
}

module.exports = connectMongo;
