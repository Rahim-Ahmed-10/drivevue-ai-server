import { Router } from 'express';
import authRoutes from './authRoutes';
import carRoutes from './carRoutes';
import bookingRoutes from './bookingRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/cars', carRoutes);
router.use('/bookings', bookingRoutes);

export default router;
