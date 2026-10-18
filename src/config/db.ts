import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drivevue-ai';

if (!MONGODB_URI) {
  throw new Error('[Database Error] MONGODB_URI environment variable is missing.');
}

// Explicitly disable Mongoose buffering globally to prevent 10,000ms buffering timeouts
mongoose.set('bufferCommands', false);

// Global caching system for Vercel Serverless Functions
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache as MongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

const connectDB = async (): Promise<typeof mongoose> => {
  // 1. Re-use existing connection if already established and ready
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  // If connection was disconnected, clear stale reference
  if (cached.conn && cached.conn.connection.readyState !== 1) {
    cached.conn = null;
    cached.promise = null;
  }

  // 2. Create connection promise if not exists
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      dbName: 'drivevue-ai',
      bufferCommands: false, // Disables Mongoose buffering to fix 10000ms timeout
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout to fail fast
      autoIndex: process.env.NODE_ENV !== 'production',
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
    cached.conn = null;
    console.error(`[Database Error] Failed to connect to MongoDB:`, error);
    // Do NOT call process.exit(1) - allow serverless functions and Express error handlers to handle it
    throw error;
  }

  return cached.conn;
};

export default connectDB;