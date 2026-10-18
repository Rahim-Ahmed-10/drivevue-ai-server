import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import User from '../models/User';
import bcrypt from 'bcryptjs';

async function seedAdminUser() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drivevue-ai';
  console.log('[Atlas Verification] Connecting to MongoDB Atlas...');

  try {
    const conn = await mongoose.connect(mongoUri, {
      dbName: 'drivevue-ai',
    });

    console.log(`[Atlas Verification] Successfully connected to host: ${conn.connection.host}`);
    console.log(`[Atlas Verification] Database Name: ${conn.connection.name}`);

    const adminEmail = 'admin@drivevue.com';
    const targetPassword = 'Rahim321';
    const targetRole = 'admin';

    let user = await User.findOne({ email: adminEmail });

    if (user) {
      console.log(`[Atlas Seed] Existing user found for ${adminEmail}. Updating role and password...`);
      user.role = targetRole;
      user.password = targetPassword; // Pre-save hook will hash this
      await user.save();
      console.log(`[Atlas Seed] User updated successfully!`);
    } else {
      console.log(`[Atlas Seed] User ${adminEmail} not found. Creating new admin user...`);
      user = new User({
        name: 'Admin Rahim',
        email: adminEmail,
        password: targetPassword,
        role: targetRole,
      });
      await user.save();
      console.log(`[Atlas Seed] Admin user created successfully!`);
    }

    // Verify in Atlas
    const verifiedUser = await User.findOne({ email: adminEmail });
    if (!verifiedUser) {
      throw new Error('Verification failed: User not found after save!');
    }

    const isMatch = await verifiedUser.comparePassword(targetPassword);
    console.log('[Atlas Verification] Verification results:');
    console.log(`  - ID: ${verifiedUser._id}`);
    console.log(`  - Name: ${verifiedUser.name}`);
    console.log(`  - Email: ${verifiedUser.email}`);
    console.log(`  - Role: ${verifiedUser.role}`);
    console.log(`  - Password verification with '${targetPassword}': ${isMatch ? 'PASSED (valid)' : 'FAILED'}`);

    if (verifiedUser.role !== 'admin' || !isMatch) {
      throw new Error('Admin role or password check failed!');
    }

    console.log('[Atlas Seed] ALL CHECKS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('[Atlas Seed Error]', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[Atlas Verification] Disconnected cleanly from MongoDB Atlas.');
  }
}

seedAdminUser();
