import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');

if (!stripeKey && process.env.NODE_ENV !== 'test') {
  console.warn('[Stripe] Warning: STRIPE_SECRET_KEY is not set in environment variables.');
}

export const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });

export default stripe;
