import { Router } from 'express';
import {
  createBooking,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
} from '../controllers/bookingController';
import { verifyToken, verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Protected user routes (any authenticated user)
router.post('/', verifyToken, createBooking);
router.get('/my-bookings', verifyToken, getMyBookings);
router.patch('/cancel/:id', verifyToken, cancelBooking);

// Protected admin routes (admin only via verifyAdmin)
router.get('/', verifyToken, verifyAdmin, getAllBookings);
router.patch('/:id/status', verifyToken, verifyAdmin, updateBookingStatus);
router.patch('/status/:id', verifyToken, verifyAdmin, updateBookingStatus);

export default router;
