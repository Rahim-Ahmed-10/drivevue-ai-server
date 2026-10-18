import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drivevue-ai';

if (!MONGODB_URI) {
  throw new Error('[Database Error] MONGODB_URI environment variable is missing.');
}

// Global caching system for Vercel Serverless Functions
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

const connectDB = async (): Promise<typeof mongoose> => {
  // 1. Re-use existing connection if already established
  if (cached.conn) {
    return cached.conn;
  }

  // 2. Create connection promise if not exists
  if (!cached.promise) {
    const opts = {
      dbName: 'drivevue-ai',
      bufferCommands: false, // 🔴 Disables Mongoose buffering to fix 10000ms timeout
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log(`[Database] MongoDB Atlas Connected: ${mongooseInstance.connection.host} (Database: ${mongooseInstance.connection.name})`);
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error(`[Database Error] Failed to connect to MongoDB:`, error);
    throw error;
  }

  return cached.conn;
};

export default connectDB;