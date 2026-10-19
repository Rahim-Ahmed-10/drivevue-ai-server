import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db';
import { seedDefaultUsers } from '../utils/seedDefaultUsers';

async function runSeed() {
  console.log('[Seed CLI] Starting demo users seeding process...');

  try {
    // 1. Seed database using standard server connection
    await connectDB();
    const result = await seedDefaultUsers();
    console.log(`[Seed CLI] Primary database seed: ${result.message}`);

    // 2. Also ensure 'drivevue-ai' database is synced if different
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (mongoUri) {
      try {
        const driveVueConn = await mongoose.createConnection(mongoUri, {
          dbName: 'drivevue-ai',
        }).asPromise();
        
        // Define User on this connection to ensure demo users exist in 'drivevue-ai' db as well
        const UserSchema = (await import('../models/User')).default.schema;
        const AltUser = driveVueConn.model('User', UserSchema);
        const bcrypt = (await import('bcryptjs')).default;

        // Check user@gmail.com
        let demoUser = await AltUser.findOne({ email: 'user@gmail.com' });
        if (!demoUser) {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('user123', salt);
          await AltUser.create({
            name: 'Demo Driver',
            email: 'user@gmail.com',
            password: hashedPassword,
            role: 'user',
          });
          console.log('[Seed CLI] Synced demo user into drivevue-ai db');
        }

        // Check admin@drivevue.com
        let adminUser = await AltUser.findOne({ email: 'admin@drivevue.com' });
        if (!adminUser) {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('admin123456', salt);
          await AltUser.create({
            name: 'DriveVue Admin',
            email: 'admin@drivevue.com',
            password: hashedPassword,
            role: 'admin',
          });
          console.log('[Seed CLI] Synced admin user into drivevue-ai db');
        }

        await driveVueConn.close();
      } catch (err: any) {
        console.warn('[Seed CLI] Notice: drivevue-ai secondary sync skipped:', err.message);
      }
    }

    console.log('[Seed CLI] ALL DEMO USERS SEEDED SUCCESSFULLY!');
    console.log('Credentials:');
    console.log('  1. Demo User:  Email: user@gmail.com        | Password: user123');
    console.log('  2. Demo Admin: Email: admin@drivevue.com       | Password: admin123456 | Code: DriveVueAdmin2026');
  } catch (error: any) {
    console.error('[Seed CLI Error]', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[Seed CLI] Finished and disconnected cleanly.');
  }
}

runSeed();
