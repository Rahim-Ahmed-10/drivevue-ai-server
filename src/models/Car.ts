import { Schema, model, Types } from 'mongoose';

export type CarStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';

export interface ICar {
  _id?: Types.ObjectId;
  title: string;
  brand: string;
  model: string;
  year: number;
  category: string;
  pricePerDay: number;
  passengerCap: number;
  imageUrl: string;
  status: CarStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const carSchema = new Schema<ICar>(
  {
    title: {
      type: String,
      required: [true, 'Please provide a car title'],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, 'Please provide the car brand'],
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'Please provide the car model'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Please provide the manufacture year'],
    },
    category: {
      type: String,
      required: [true, 'Please provide the vehicle category (e.g. Sedan, SUV, Luxury)'],
      trim: true,
    },
    pricePerDay: {
      type: Number,
      required: [true, 'Please provide the daily rental rate'],
      min: [0, 'Daily rate cannot be negative'],
    },
    passengerCap: {
      type: Number,
      required: [true, 'Please provide passenger capacity'],
      min: [1, 'Passenger capacity must be at least 1'],
    },
    imageUrl: {
      type: String,
      required: [true, 'Please provide an image URL'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'RENTED', 'MAINTENANCE'],
      default: 'AVAILABLE',
    },
  },
  {
    timestamps: true,
  }
);

export const Car = model<ICar>('Car', carSchema);
export default Car;
