import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key';

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV !== 'test') {
  console.warn('[Stripe] Warning: STRIPE_SECRET_KEY is not set in environment variables.');
}

export const stripe = new Stripe(stripeSecretKey);

export default stripe;
