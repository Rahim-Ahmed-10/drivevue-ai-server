import { Router } from 'express';
import { createBooking, getMyBookings } from '../controllers/bookingController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.use(protect); // all booking routes require authentication

router.post('/', createBooking);
router.get('/my-bookings', getMyBookings);

export default router;
