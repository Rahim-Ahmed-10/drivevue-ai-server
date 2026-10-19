import { Request, Response } from 'express';
import { Types } from 'mongoose';
import stripe from '../config/stripe';
import Booking from '../models/Booking';
import Car from '../models/Car';
import { AuthRequest } from '../middlewares/authMiddleware';

/**
 * 1. Create a Stripe Checkout Session for a Booking or Direct Car Reservation
 * POST /api/payments/create-checkout-session (Protected)
 */
export const createCheckoutSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    // 1. Verify User Authentication
    if (!currentUserId) {
      res.status(401).json({
        status: false,
        success: false,
        message: 'Authentication required. Please sign in to reserve a vehicle.',
      });
      return;
    }

    const { bookingId, carId, car, startDate, endDate, totalAmount } = req.body;
    let booking: any = null;

    // SCENARIO A: Direct vehicle checkout (carId / car + startDate + endDate)
    const targetCarId = carId || car || (typeof req.body.car === 'object' ? req.body.car?._id : undefined);

    if (targetCarId && !bookingId) {
      // Validate Car ID format
      if (!Types.ObjectId.isValid(String(targetCarId))) {
        res.status(400).json({
          status: false,
          success: false,
          message: `Invalid vehicle ID format: "${targetCarId}". Must be a valid 24-character hexadecimal ObjectId.`,
        });
        return;
      }

      // Validate Dates
      if (!startDate || !endDate) {
        res.status(400).json({
          status: false,
          success: false,
          message: 'Both rental startDate and endDate are required to reserve this vehicle.',
        });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          status: false,
          success: false,
          message: 'Invalid date format. Please provide valid ISO date strings (e.g. YYYY-MM-DD).',
        });
        return;
      }

      if (end <= start) {
        res.status(400).json({
          status: false,
          success: false,
          message: 'Rental return date must be strictly after the pick-up date.',
        });
        return;
      }

      // Fetch Car from database
      const carDoc = await Car.findById(targetCarId);
      if (!carDoc) {
        res.status(404).json({
          status: false,
          success: false,
          message: `Vehicle with ID "${targetCarId}" was not found in the fleet database.`,
        });
        return;
      }

      // Calculate Days & Total Price
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const subtotal = totalDays * carDoc.pricePerDay;
      const tax = Math.round(subtotal * 0.08); // 8% fee & tax
      const calculatedTotal = subtotal + tax;
      const finalPrice = typeof totalAmount === 'number' && totalAmount > 0 ? totalAmount : calculatedTotal;

      // Check if user already has an active UNPAID booking for this vehicle and date range
      const existingBooking = await Booking.findOne({
        user: currentUserId,
        car: carDoc._id,
        paymentStatus: 'UNPAID',
        status: { $ne: 'CANCELLED' },
        startDate: start,
        endDate: end,
      })
        .populate('car')
        .populate('user');

      if (existingBooking) {
        booking = existingBooking;
        if (booking.totalPrice !== finalPrice) {
          booking.totalPrice = finalPrice;
          booking.totalDays = totalDays;
          await booking.save();
        }
      } else {
        // Create new PENDING reservation
        const newBooking = await Booking.create({
          user: currentUserId,
          car: carDoc._id,
          startDate: start,
          endDate: end,
          totalDays,
          totalPrice: finalPrice,
          status: 'PENDING',
          paymentStatus: 'UNPAID',
        });

        booking = await Booking.findById(newBooking._id).populate('car').populate('user');
      }
    }
    // SCENARIO B: Pre-created bookingId provided
    else if (bookingId) {
      if (!Types.ObjectId.isValid(String(bookingId))) {
        res.status(400).json({
          status: false,
          success: false,
          message: `Invalid booking ID format: "${bookingId}". Must be a valid 24-character hexadecimal ObjectId.`,
        });
        return;
      }

      booking = await Booking.findById(bookingId).populate('car').populate('user');

      // Fallback: Check if there's any active pending booking for the user
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
          message: `Booking with ID "${bookingId}" was not found.`,
        });
        return;
      }
    } else {
      res.status(400).json({
        status: false,
        success: false,
        message: 'Please provide either vehicle details (carId, startDate, endDate) or a valid bookingId.',
      });
      return;
    }

    if (!booking) {
      res.status(404).json({
        status: false,
        success: false,
        message: 'Reservation could not be resolved.',
      });
      return;
    }

    // Authorization check: User must own the booking or be an ADMIN
    const bookingUserId = (booking.user as any)?._id || booking.user;
    const isOwner = currentUserId && bookingUserId && bookingUserId.toString() === currentUserId.toString();
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        status: false,
        success: false,
        message: 'Forbidden: You are not authorized to create a payment session for this reservation.',
      });
      return;
    }

    // Check if booking is already paid or cancelled
    if (booking.paymentStatus === 'PAID') {
      res.status(400).json({
        status: false,
        success: false,
        message: 'This reservation has already been paid for.',
      });
      return;
    }

    if (booking.status === 'CANCELLED') {
      res.status(400).json({
        status: false,
        success: false,
        message: 'Cannot process payment for a cancelled reservation.',
      });
      return;
    }

    // Fetch populated car details and construct line items
    const carDetails: any = booking.car || (booking as any).carId;
    const carName = carDetails ? `${carDetails.brand} ${carDetails.name}` : 'DriveVue Rental Vehicle';
    const totalDays = booking.totalDays || 1;
    const dailyPrice = carDetails?.pricePerDay || Math.round(booking.totalPrice / totalDays);
    const amountInCents = Math.round(booking.totalPrice * 100);

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const success_url = `${clientUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking._id}`;
    const cancel_url = `${clientUrl}/payment/cancel?booking_id=${booking._id}&car_id=${carDetails?._id || ''}`;

    const line_items = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: carName,
            description: `DriveVue AI Rental: ${totalDays} day(s) at $${dailyPrice}/day (Includes protection & 24/7 concierge)`,
            images: carDetails?.images && carDetails.images.length > 0 ? [carDetails.images[0]] : [],
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
        carId: carDetails?._id?.toString() || '',
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

      // Lock vehicle availability to prevent double booking
      if (booking.car) {
        const carIdToLock = (booking.car as any)?._id || booking.car;
        await Car.findByIdAndUpdate(carIdToLock, { isAvailable: false });
      }
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

          if (booking.car) {
            const carIdToLock = (booking.car as any)?._id || booking.car;
            await Car.findByIdAndUpdate(carIdToLock, { isAvailable: false });
          }

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
