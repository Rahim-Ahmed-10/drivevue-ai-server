import { Schema, model, Types } from 'mongoose';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface IBooking {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  carId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  totalDays: number;
  totalPrice: number;
  status: BookingStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking must be linked to a user'],
    },
    carId: {
      type: Schema.Types.ObjectId,
      ref: 'Car',
      required: [true, 'Booking must be linked to a car'],
    },
    startDate: {
      type: Date,
      required: [true, 'Please provide the rental start date'],
    },
    endDate: {
      type: Date,
      required: [true, 'Please provide the rental end date'],
    },
    totalDays: {
      type: Number,
      required: [true, 'Please provide total rental days'],
      min: [1, 'Rental duration must be at least 1 day'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Please provide total rental price'],
      min: [0, 'Total price cannot be negative'],
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  }
);

export const Booking = model<IBooking>('Booking', bookingSchema);
export default Booking;
