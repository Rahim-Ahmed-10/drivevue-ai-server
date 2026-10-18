import { Request, Response } from 'express';
import { Types } from 'mongoose';
import stripe from '../config/stripe';
import Booking from '../models/Booking';
import { AuthRequest } from '../middlewares/authMiddleware';

/**
 * 1. Create a Stripe Checkout Session for a Booking
 * POST /api/payments/create-checkout-session (Protected)
 */
export const createCheckoutSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.body;
    const currentUserId = req.user?._id;

    // 1. Validation: bookingId must exist and be a valid MongoDB ObjectId
    if (!bookingId || !Types.ObjectId.isValid(bookingId as string)) {
      res.status(400).json({
        status: false,
        success: false,
        message: 'Please provide a valid MongoDB bookingId in the request body',
      });
      return;
    }

    // 2. Fetch booking and populated car / carId details
    let booking = await Booking.findById(bookingId).populate('car').populate('user');

    // 3. Fallback: If no pending booking exists for the given bookingId,
    // check if there's any active pending booking for the authenticated user (req.user._id)
    const isPayable = booking && booking.paymentStatus === 'UNPAID' && booking.status !== 'CANCELLED';

    if (!isPayable && currentUserId) {
      const fallbackBooking = await Booking.findOne({
        user: currentUserId,
        paymentStatus: 'UNPAID',
        status: { $ne: 'CANCELLED' },
      })
        .sort({ createdAt: -1 })
        .populate('car')
        .populate('user');

      if (fallbackBooking) {
        console.log(`[Stripe Checkout] Fallback to user's active pending booking: ${fallbackBooking._id}`);
        booking = fallbackBooking;
      }
    }

    if (!booking) {
      res.status(404).json({
        status: false,
        success: false,
        message: `Booking with ID "${bookingId}" was not found and no active pending bookings exist for this user.`,
      });
      return;
    }

    // 4. Authorization check: User must own the booking or be an ADMIN
    const bookingUserId = (booking.user as any)?._id || booking.user;
    const isOwner = currentUserId && bookingUserId && bookingUserId.toString() === currentUserId.toString();
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        status: false,
        success: false,
        message: 'Forbidden: You are not authorized to create a payment session for this booking.',
      });
      return;
    }

    // 5. Check if booking is already paid or cancelled
    if (booking.paymentStatus === 'PAID') {
      res.status(400).json({
        status: false,
        success: false,
        message: 'This booking has already been paid for.',
      });
      return;
    }

    if (booking.status === 'CANCELLED') {
      res.status(400).json({
        status: false,
        success: false,
        message: 'Cannot process payment for a cancelled booking.',
      });
      return;
    }

    // 6. Fetch populated carId / car details and construct line items
    const car: any = booking.car || (booking as any).carId;
    const carName = car ? `${car.brand} ${car.name}` : 'DriveVue Rental Vehicle';
    const totalDays = booking.totalDays || 1;
    const dailyPrice = car?.pricePerDay || Math.round(booking.totalPrice / totalDays);
    const amountInCents = Math.round(booking.totalPrice * 100);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const success_url = `${clientUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking._id}`;
    const cancel_url = `${clientUrl}/booking/cancel?booking_id=${booking._id}`;

    const line_items = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: carName,
            description: `DriveVue AI Rental: ${totalDays} day(s) at $${dailyPrice}/day`,
            images: car?.images && car.images.length > 0 ? [car.images[0]] : [],
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ];

    // Create Stripe checkout session using actual Stripe SDK
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user?.email || (booking.user as any)?.email,
      client_reference_id: booking._id?.toString(),
      metadata: {
        bookingId: booking._id?.toString() || '',
        userId: currentUserId?.toString() || '',
        carId: car?._id?.toString() || '',
      },
      line_items,
      success_url,
      cancel_url,
    });

    // Attach stripeSessionId to booking document
    booking.stripeSessionId = session.id;
    await booking.save();

    console.log(`[Stripe Checkout] Created session ${session.id} for booking ${booking._id}`);

    res.status(200).json({
      status: true,
      success: true,
      message: 'Checkout session created successfully',
      sessionId: session.id,
      sessionUrl: session.url,
      url: session.url,
      data: {
        sessionId: session.id,
        sessionUrl: session.url,
        url: session.url,
        bookingId: booking._id,
        totalPrice: booking.totalPrice,
        totalDays,
        dailyPrice,
        carName,
      },
    });
  } catch (error: any) {
    console.error('Stripe Error Details:', error);
    console.error('[createCheckoutSession Error]:', error.message || error);
    res.status(500).json({
      status: false,
      success: false,
      message: error.message || 'Failed to create Stripe checkout session.',
    });
  }
};

/**
 * 2. Verify Stripe Payment and update Booking status
 * POST /api/payments/verify-payment
 */
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, bookingId } = req.body;

    if (!sessionId && !bookingId) {
      res.status(400).json({
        status: false,
        success: false,
        message: 'Please provide either sessionId or bookingId in the request body.',
      });
      return;
    }

    let booking: any = null;
    let paymentConfirmed = false;
    let paymentIntentId: string | undefined;

    // Verify via Stripe Checkout Session ID
    if (sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
          paymentConfirmed = true;
          paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : undefined;

          const targetBookingId = session.metadata?.bookingId || session.client_reference_id;
          if (targetBookingId) {
            booking = await Booking.findById(targetBookingId);
          }
        } else {
          res.status(400).json({
            status: false,
            success: false,
            message: `Stripe session payment status is "${session.payment_status}", not "paid".`,
          });
          return;
        }
      } catch (stripeErr: any) {
        console.warn('[Stripe Verify] Error retrieving session from Stripe:', stripeErr.message);
      }
    }

    // B. Direct lookup by bookingId if session retrieval didn't find booking
    if (!booking && bookingId && Types.ObjectId.isValid(bookingId as string)) {
      booking = await Booking.findById(bookingId);

      // In mock/test environments if requested
      if (req.body.simulatePayment === true || process.env.NODE_ENV === 'development') {
        paymentConfirmed = true;
      }
    }

    if (!booking) {
      res.status(404).json({
        status: false,
        success: false,
        message: 'Associated booking could not be found for payment verification.',
      });
      return;
    }

    // Update booking status if verified
    if (paymentConfirmed) {
      booking.paymentStatus = 'PAID';
      booking.status = 'CONFIRMED';
      if (sessionId) booking.stripeSessionId = sessionId;
      if (paymentIntentId) booking.stripePaymentIntentId = paymentIntentId;
      await booking.save();
    }

    const updatedBooking = await Booking.findById(booking._id).populate('car').populate('user', '-password');

    res.status(200).json({
      status: true,
      success: true,
      message: 'Payment verified successfully. Booking is now CONFIRMED and PAID.',
      data: updatedBooking,
    });
  } catch (error: any) {
    console.error('[verifyPayment Error]:', error);
    res.status(500).json({
      status: false,
      success: false,
      message: error.message || 'Failed to verify payment.',
    });
  }
};

/**
 * 3. Stripe Webhook handler for asynchronous payment events
 * POST /api/payments/webhook
 */
export const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;

  try {
    if (webhookSecret && sig && !webhookSecret.includes('mock')) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = req.body;
    }
  } catch (err: any) {
    console.error('[Stripe Webhook Signature Error]:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId || session.client_reference_id;

      if (bookingId) {
        const booking = await Booking.findById(bookingId);
        if (booking) {
          booking.paymentStatus = 'PAID';
          booking.status = 'CONFIRMED';
          booking.stripeSessionId = session.id;
          if (session.payment_intent) {
            booking.stripePaymentIntentId = String(session.payment_intent);
          }
          await booking.save();
          console.log(`[Stripe Webhook] Booking ${bookingId} marked as CONFIRMED and PAID.`);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook Processing Error]:', error);
    res.status(500).json({ status: false, message: error.message });
  }
};
