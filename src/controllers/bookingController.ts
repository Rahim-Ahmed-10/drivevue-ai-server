import { Response } from 'express';
import { Types } from 'mongoose';
import Booking from '../models/Booking';
import Car from '../models/Car';
import { AuthRequest } from '../middlewares/authMiddleware';

/**
 * 1. Create a new booking (Protected - Logged-in users)
 * POST /api/bookings
 */
export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        status: 'error',
        success: false,
        message: 'Authentication required. User not identified.',
      });
      return;
    }

    // Support both 'car' and 'carId' in payload
    const carId = req.body.car || req.body.carId;
    const { startDate, endDate } = req.body;

    if (!carId || !startDate || !endDate) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: 'Validation failed: car, startDate, and endDate are all required.',
        errors: {
          ...(!carId && { car: 'Car ID is required' }),
          ...(!startDate && { startDate: 'Rental start date is required' }),
          ...(!endDate && { endDate: 'Rental end date is required' }),
        },
      });
      return;
    }

    if (!Types.ObjectId.isValid(carId)) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid car ID format: "${carId}". Must be a valid 24-character hexadecimal ObjectId.`,
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: 'Invalid date format. Please provide valid ISO date strings (e.g. YYYY-MM-DD).',
      });
      return;
    }

    if (end <= start) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: 'End date must be strictly after start date.',
      });
      return;
    }

    // 1. Validate if the car exists
    const car = await Car.findById(carId);
    if (!car) {
      res.status(404).json({
        status: 'error',
        success: false,
        message: `Car with ID "${carId}" was not found.`,
      });
      return;
    }

    // 2. Validate if the car is available
    if (!car.isAvailable) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: 'This car is currently not available for rental booking.',
      });
      return;
    }

    // 3. Calculate totalDays and totalPrice automatically
    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalPrice = totalDays * car.pricePerDay;

    // 4. Create the booking record with direct CONFIRMED status
    const booking = await Booking.create({
      user: userId,
      car: car._id,
      startDate: start,
      endDate: end,
      totalDays,
      totalPrice,
      status: 'CONFIRMED', // 🔴 সরাসরি কনফার্মড হয়ে যাবে
      paymentStatus: 'PAID', // অথবা আপনার রিকোয়ারমেন্ট অনুযায়ী
    });

    // 5. Mark the car as unavailable immediately to prevent double booking
    await Car.findByIdAndUpdate(car._id, { isAvailable: false });

    // Populate car details in response
    const populatedBooking = await Booking.findById(booking._id).populate('car');

    res.status(201).json({
      status: 'success',
      success: true,
      message: 'Booking created and confirmed successfully',
      data: populatedBooking || booking,
    });
  } catch (error: any) {
    console.error('[createBooking Error]:', error);

    if (error.name === 'ValidationError') {
      const errorMap: Record<string, string> = {};
      for (const key of Object.keys(error.errors)) {
        errorMap[key] = error.errors[key].message;
      }
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Validation failed: ${Object.values(errorMap).join('; ')}`,
        errors: errorMap,
      });
      return;
    }

    res.status(400).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to create booking',
    });
  }
};

/**
 * 2. Get bookings for the currently authenticated user (Protected - Logged-in users)
 * GET /api/bookings/my-bookings
 */
export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({
        status: 'error',
        success: false,
        message: 'Authentication required. User not identified.',
      });
      return;
    }

    const bookings = await Booking.find({ user: userId })
      .populate('car')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      success: true,
      count: bookings.length,
      results: bookings.length,
      data: bookings,
    });
  } catch (error: any) {
    console.error('[getMyBookings Error]:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to fetch your bookings',
    });
  }
};

/**
 * 3. Cancel user's own booking (Protected - Logged-in users)
 * PATCH /api/bookings/cancel/:id
 */
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;

    if (!id || !Types.ObjectId.isValid(id as string)) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid booking ID format: "${id}". Must be a valid 24-character hexadecimal ObjectId.`,
      });
      return;
    }

    const booking = await Booking.findById(id).populate('car');
    if (!booking) {
      res.status(404).json({
        status: 'error',
        success: false,
        message: `Booking with ID "${id}" was not found.`,
      });
      return;
    }

    // Verify ownership: Only the owner or an ADMIN can cancel this booking
    const isOwner = userId && booking.user.toString() === userId.toString();
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      res.status(403).json({
        status: 'error',
        success: false,
        message: 'Forbidden: You are not authorized to cancel this booking.',
      });
      return;
    }

    // Check existing status
    if (booking.status === 'CANCELLED') {
      res.status(400).json({
        status: 'error',
        success: false,
        message: 'This booking has already been cancelled.',
      });
      return;
    }

    if (booking.status === 'COMPLETED') {
      res.status(400).json({
        status: 'error',
        success: false,
        message: 'Completed bookings cannot be cancelled.',
      });
      return;
    }

    booking.status = 'CANCELLED';
    await booking.save();

    // Release car back to available pool
    if (booking.car) {
      await Car.findByIdAndUpdate((booking.car as any)._id, { isAvailable: true });
    }

    const updatedBooking = await Booking.findById(id).populate('car');

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'Booking cancelled successfully',
      data: updatedBooking || booking,
    });
  } catch (error: any) {
    console.error('[cancelBooking Error]:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to cancel booking',
    });
  }
};

/**
 * 4. Get all bookings in the system (Protected - Admin only)
 * GET /api/bookings
 */
export const getAllBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookings = await Booking.find()
      .populate('user', '-password')
      .populate('car')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      success: true,
      count: bookings.length,
      results: bookings.length,
      data: bookings,
    });
  } catch (error: any) {
    console.error('[getAllBookings Error]:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to fetch all bookings',
    });
  }
};

/**
 * 5. Update booking status & manage car availability (Protected - Admin only)
 * PATCH /api/bookings/:id/status
 */
export const updateBookingStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !Types.ObjectId.isValid(id as string)) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid booking ID format: "${id}".`,
      });
      return;
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
    const normalizedStatus = String(status || '').toUpperCase();
    if (!validStatuses.includes(normalizedStatus)) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid status "${status}". Allowed values: ${validStatuses.join(', ')}.`,
      });
      return;
    }

    const booking = await Booking.findById(id).populate('car');
    if (!booking) {
      res.status(404).json({
        status: 'error',
        success: false,
        message: `Booking with ID "${id}" was not found.`,
      });
      return;
    }

    booking.status = normalizedStatus as any;
    await booking.save();

    // Sync car availability with status update
    if (booking.car) {
      const carId = (booking.car as any)._id;
      if (normalizedStatus === 'CONFIRMED' || normalizedStatus === 'COMPLETED') {
        await Car.findByIdAndUpdate(carId, { isAvailable: false });
      } else if (normalizedStatus === 'CANCELLED') {
        await Car.findByIdAndUpdate(carId, { isAvailable: true });
      }
    }

    const updatedBooking = await Booking.findById(id)
      .populate('user', '-password')
      .populate('car');

    res.status(200).json({
      status: 'success',
      success: true,
      message: `Booking status updated to ${normalizedStatus} successfully`,
      data: updatedBooking || booking,
    });
  } catch (error: any) {
    console.error('[updateBookingStatus Error]:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to update booking status',
    });
  }
};