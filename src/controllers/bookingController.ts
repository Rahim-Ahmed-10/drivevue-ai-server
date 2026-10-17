import { Response } from 'express';
import Booking from '../models/Booking';
import Car from '../models/Car';
import { AuthRequest } from '../middlewares/authMiddleware';

export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { carId, startDate, endDate } = req.body;
    const userId = req.user?._id;

    const car = await Car.findById(carId);
    if (!car) {
      res.status(404).json({ success: false, message: 'Car not found' });
      return;
    }

    if (car.status !== 'AVAILABLE') {
      res.status(400).json({ success: false, message: 'Car is not available for booking' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const totalPrice = totalDays * car.pricePerDay;

    const booking = await Booking.create({
      userId,
      carId,
      startDate: start,
      endDate: end,
      totalDays,
      totalPrice,
      status: 'PENDING',
    });

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const bookings = await Booking.find({ userId: req.user?._id })
      .populate('carId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
