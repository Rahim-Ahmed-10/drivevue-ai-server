import { Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const getJwtSecret = (): string => process.env.JWT_SECRET || 'drivevue_super_secret_jwt_key_2026';
const getAdminSecretCode = (): string => process.env.ADMIN_SECRET_CODE || 'DriveVueAdmin2026';

// ১. Register Controller
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, adminCode } = req.body;

    const normalizedEmail = (email || '').trim().toLowerCase();

    // @drivevue.com ডোমেইন চেক (যেকোনো নাম@drivevue.com)
    const isDriveVueEmail = normalizedEmail.endsWith('@drivevue.com');

    // অ্যাডমিন ডোমেইন হলে Secret Code যাচাই
    if (isDriveVueEmail) {
      if (!adminCode || adminCode !== getAdminSecretCode()) {
        res.status(403).json({
          status: 'error',
          message: 'Invalid or missing Admin Secret Code. Access denied.',
        });
        return;
      }
    }

    // রোল নির্ধারণ: @drivevue.com হলে "admin", অন্য ডোমেইন হলে "user"
    const assignedRole = isDriveVueEmail ? 'admin' : 'user';

    // ইউজার ইতিমধ্যে আছে কিনা চেক
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(400).json({ status: 'error', message: 'User already exists with this email.' });
      return;
    }

    // নতুন ইউজার তৈরি
    const newUser = new User({
      name: name ? name.trim() : 'Driver',
      email: normalizedEmail,
      password: password,
      role: assignedRole,
    });

    await newUser.save();

    // JWT টোকেন জেনারেট
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
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ২. Login Controller
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, adminCode } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    // ইউজার খুঁজুন
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found!' });
      return;
    }

    // পাসওয়ার্ড ভ্যালিডেশন
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ status: 'error', message: 'Invalid credentials!' });
      return;
    }

    const isDriveVueEmail = normalizedEmail.endsWith('@drivevue.com');

    // অ্যাডমিন ডোমেইন বা রোল হলে Secret Code যাচাই
    if (isDriveVueEmail || user.role === 'admin') {
      if (!adminCode || adminCode !== getAdminSecretCode()) {
        res.status(403).json({
          status: 'error',
          message: 'Invalid or missing Admin Secret Code for Admin Login.',
        });
        return;
      }

      // রোল যদি আগে "admin" সেট করা না থাকে, তবে ডাটাবেজে আপডেট
      if (user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
    }

    // JWT টোকেন জেনারেট
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
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ৩. Temporary Admin Seed Controller
export const seedAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminEmail = 'admin@drivevue.com';
    const password = req.body?.password || req.query?.password || 'admin123456';
    let user = await User.findOne({ email: adminEmail });

    if (user) {
      user.role = 'admin';
      user.password = String(password);
      await user.save();

      const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        getJwtSecret(),
        { expiresIn: '7d' }
      );

      res.status(200).json({
        status: 'success',
        message: 'Admin account verified, role set to "admin"!',
        token,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
      return;
    }

    user = new User({
      name: 'DriveVue Admin',
      email: adminEmail,
      password: String(password),
      role: 'admin',
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      message: 'Admin account seeded successfully with email admin@drivevue.com',
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};