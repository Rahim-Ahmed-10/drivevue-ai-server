import { Router } from 'express';
import {
  createBooking,
  getMyBookings,
  cancelBooking,
  getAllBookings,
} from '../controllers/bookingController';
import { verifyToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Protected user routes (any authenticated user)
router.post('/', verifyToken, createBooking);
router.get('/my-bookings', verifyToken, getMyBookings);
router.patch('/cancel/:id', verifyToken, cancelBooking);

// Protected admin route (admin only)
router.get('/', verifyToken, authorizeRoles('ADMIN'), getAllBookings);

export default router;
