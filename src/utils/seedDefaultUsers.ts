import bcrypt from 'bcryptjs';
import User from '../models/User';

/**
 * Ensures demo user (user@gmail.com) and demo admin (admin@drivevue.com)
 * exist in the database with their expected credentials.
 */
export const seedDefaultUsers = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Seed or verify Demo Regular User
    const demoUserEmail = 'user@gmail.com';
    const demoUserPassword = 'user123';
    let demoUser = await User.findOne({ email: demoUserEmail });

    if (!demoUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(demoUserPassword, salt);
      demoUser = new User({
        name: 'Demo Driver',
        email: demoUserEmail,
        password: hashedPassword,
        role: 'user',
      });
      await demoUser.save();
      console.log(`[Seed] Created default demo user: ${demoUserEmail} / ${demoUserPassword}`);
    } else {
      const isMatch = await bcrypt.compare(demoUserPassword, demoUser.password);
      if (!isMatch) {
        const salt = await bcrypt.genSalt(10);
        demoUser.password = await bcrypt.hash(demoUserPassword, salt);
        await demoUser.save();
        console.log(`[Seed] Updated password for demo user: ${demoUserEmail}`);
      }
    }

    // 2. Seed or verify Demo Admin User
    const adminEmail = 'admin@drivevue.com';
    const adminPassword = 'admin123456';
    let adminUser = await User.findOne({ email: adminEmail });

    if (!adminUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      adminUser = new User({
        name: 'DriveVue Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
      });
      await adminUser.save();
      console.log(`[Seed] Created default admin user: ${adminEmail} / ${adminPassword}`);
    } else {
      const isMatch = await bcrypt.compare(adminPassword, adminUser.password);
      if (!isMatch) {
        const salt = await bcrypt.genSalt(10);
        adminUser.password = await bcrypt.hash(adminPassword, salt);
      }
      if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
      }
      await adminUser.save();
      console.log(`[Seed] Verified admin user: ${adminEmail}`);
    }

    return {
      success: true,
      message: 'Default demo user and admin verified/seeded successfully.',
    };
  } catch (error: any) {
    console.error('[Seed Error] Failed to seed default users:', error.message);
    return {
      success: false,
      message: error.message || 'Failed to seed default users',
    };
  }
};

export default seedDefaultUsers;
