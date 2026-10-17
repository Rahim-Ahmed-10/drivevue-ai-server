import { Router } from 'express';
import {
  createCheckoutSession,
  verifyPayment,
  stripeWebhook,
} from '../controllers/paymentController';
import { verifyToken } from '../middlewares/authMiddleware';

const router = Router();

// Protected: User creates Stripe checkout session for a booking
router.post('/create-checkout-session', verifyToken, createCheckoutSession);

// Protected: Verify payment status after Stripe checkout redirect
router.post('/verify-payment', verifyToken, verifyPayment);

// Public: Stripe Webhook handler for async payment events
router.post('/webhook', stripeWebhook);

export default router;
