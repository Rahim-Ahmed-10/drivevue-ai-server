import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import connectDB from './config/db';
import { seedDefaultUsers } from './utils/seedDefaultUsers';

const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  // Connect to MongoDB
  await connectDB();

  // Auto-seed demo users on startup if they do not exist
  await seedDefaultUsers();

  // Start Express server
  app.listen(PORT, () => {
    console.log(`[Server] DriveVue AI Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

startServer();

