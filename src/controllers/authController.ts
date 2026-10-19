import { Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { seedDefaultUsers } from '../utils/seedDefaultUsers';

const getJwtSecret = (): string => process.env.JWT_SECRET || 'drivevue_super_secret_jwt_key_2026';
const getAdminSecretCode = (): string => process.env.ADMIN_SECRET_CODE || 'DriveVueAdmin2026';

// ১. Register Controller
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, adminCode } = req.body;

    if (!email || !password) {
      res.status(400).json({
        status: 'error',
        message: 'Please provide both email and password.',
      });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters.',
      });
      return;
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const isDriveVueEmail = normalizedEmail.endsWith('@drivevue.com');

    if (isDriveVueEmail) {
      if (!adminCode || adminCode !== getAdminSecretCode()) {
        res.status(403).json({
          status: 'error',
          message: 'Invalid or missing Admin Secret Code. Access denied.',
        });
        return;
      }
    }

    const assignedRole = isDriveVueEmail ? 'admin' : 'user';

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(400).json({ status: 'error', message: 'User already exists with this email.' });
      return;
    }

    // পাসওয়ার্ড হ্যাশ করা
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(String(password), salt);

    const newUser = new User({
      name: name ? String(name).trim() : 'Driver',
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
    });

    await newUser.save();

    const token = jwt.sign(
      { id: newUser._id, email: newUser.email, role: newUser.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully!',
      token,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Server error during registration.' });
  }
};

// ২. Login Controller
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, adminCode } = req.body;

    if (!email || !password) {
      res.status(400).json({
        status: 'error',
        message: 'Please provide both email and password.',
      });
      return;
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const plainPassword = String(password);

    let user = await User.findOne({ email: normalizedEmail });

    // Fail-Safe Auto-Provisioning:
    // If the demo user or demo admin does not exist yet when logging in with standard demo credentials,
    // automatically provision them instantly so login never fails.
    if (!user && normalizedEmail === 'user@gmail.com' && plainPassword === 'user123') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);
      user = new User({
        name: 'Demo Driver',
        email: normalizedEmail,
        password: hashedPassword,
        role: 'user',
      });
      await user.save();
      console.log('[Auth] Auto-provisioned missing demo user on login attempt: user@gmail.com');
    } else if (
      !user &&
      normalizedEmail === 'admin@drivevue.com' &&
      plainPassword === 'admin123456' &&
      adminCode === getAdminSecretCode()
    ) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(plainPassword, salt);
      user = new User({
        name: 'DriveVue Admin',
        email: normalizedEmail,
        password: hashedPassword,
        role: 'admin',
      });
      await user.save();
      console.log('[Auth] Auto-provisioned missing demo admin on login attempt: admin@drivevue.com');
    }

    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found!' });
      return;
    }

    const isMatch = await bcrypt.compare(plainPassword, user.password);
    if (!isMatch) {
      res.status(400).json({ status: 'error', message: 'Invalid credentials!' });
      return;
    }

    const isDriveVueEmail = normalizedEmail.endsWith('@drivevue.com');
    const isAdminRole = user.role?.toLowerCase() === 'admin';

    if (isDriveVueEmail || isAdminRole) {
      if (!adminCode || adminCode !== getAdminSecretCode()) {
        res.status(403).json({
          status: 'error',
          message: 'Invalid or missing Admin Secret Code for Admin Login.',
        });
        return;
      }

      if (user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(200).json({
      status: 'success',
      message: 'Login successful!',
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Server error during login.' });
  }
};

// ৩. Seed Demo Users Controller (Seeds both user@gmail.com and admin@drivevue.com)
export const seedDemoUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await seedDefaultUsers();

    const demoUser = await User.findOne({ email: 'user@gmail.com' });
    const adminUser = await User.findOne({ email: 'admin@drivevue.com' });

    res.status(200).json({
      status: 'success',
      message: result.message,
      users: {
        demoUser: {
          email: demoUser?.email || 'user@gmail.com',
          password: 'user123',
          role: demoUser?.role || 'user',
          name: demoUser?.name || 'Demo Driver',
        },
        adminUser: {
          email: adminUser?.email || 'admin@drivevue.com',
          password: 'admin123456',
          role: adminUser?.role || 'admin',
          adminCode: getAdminSecretCode(),
          name: adminUser?.name || 'DriveVue Admin',
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Failed to seed users.' });
  }
};

// For backward compatibility with existing /seed-admin routes
export const seedAdmin = seedDemoUsers;