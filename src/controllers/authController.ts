import { Request, Response } from 'express';
import User from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const getJwtSecret = (): string => process.env.JWT_SECRET || 'drivevue_super_secret_jwt_key_2026';

// ১. Register Controller
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    const normalizedEmail = (email || '').trim().toLowerCase();

    // Requirement 1: If email is admin@drivevue.com, set role: "admin", otherwise "user"
    const assignedRole = normalizedEmail === 'admin@drivevue.com' ? 'admin' : (role ? String(role).toLowerCase() : 'user');

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      // If admin@drivevue.com exists, ensure role is "admin"
      if (normalizedEmail === 'admin@drivevue.com' && existingUser.role !== 'admin') {
        existingUser.role = 'admin';
        await existingUser.save();
      }
      res.status(400).json({ status: 'error', message: 'User already exists with this email.' });
      return;
    }

    // Create new user (pre-save hook will hash password)
    const newUser = new User({
      name: name ? name.trim() : 'Driver',
      email: normalizedEmail,
      password: password,
      role: assignedRole,
    });

    await newUser.save();

    // Generate JWT Token with role
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
    const { email, password } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found!' });
      return;
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ status: 'error', message: 'Invalid credentials!' });
      return;
    }

    // Requirement 2: Direct check on login: if email === "admin@drivevue.com", automatically update its role in the database to "admin"
    if (normalizedEmail === 'admin@drivevue.com' && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }

    // Requirement 3: Generate JWT Token with role and send back in response
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
        message: 'Admin account verified, role set to "admin", and password configured to "admin123456"!',
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

    // If admin@drivevue.com does not exist yet, create default admin account
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
      message: 'Admin account seeded successfully with email admin@drivevue.com (default password: admin123456)',
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