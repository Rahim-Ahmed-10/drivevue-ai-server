import { Schema, model, Types } from 'mongoose';

export type CarCategory = 'Sedan' | 'SUV' | 'Luxury' | 'Electric' | 'Sports';
export type CarFuelType = 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
export type CarTransmission = 'Automatic' | 'Manual';

export interface ICar {
  _id?: Types.ObjectId;
  name: string;
  brand: string;
  model: string;
  year: number;
  pricePerDay: number;
  category: CarCategory;
  fuelType: CarFuelType;
  transmission: CarTransmission;
  seats: number;
  images: string[];
  isAvailable: boolean;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const carSchema = new Schema<ICar>(
  {
    name: {
      type: String,
      required: [true, 'Car name is required'],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, 'Car brand is required'],
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'Car model is required'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Manufacturing year is required'],
      min: [1900, 'Manufacturing year must be 1900 or later'],
      max: [new Date().getFullYear() + 2, 'Manufacturing year cannot be in the distant future'],
    },
    pricePerDay: {
      type: Number,
      required: [true, 'Price per day is required'],
      min: [0, 'Price per day cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Car category is required'],
      trim: true,
      set: (val: string) => {
        if (!val || typeof val !== 'string') return val;
        const trimmed = val.trim();
        if (trimmed.toUpperCase() === 'SUV') return 'SUV';
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      },
      enum: {
        values: ['Sedan', 'SUV', 'Luxury', 'Electric', 'Sports'],
        message: '{VALUE} is not a valid category. Must be one of: Sedan, SUV, Luxury, Electric, Sports',
      },
    },
    fuelType: {
      type: String,
      required: [true, 'Fuel type is required'],
      trim: true,
      set: (val: string) => {
        if (!val || typeof val !== 'string') return val;
        const trimmed = val.trim();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      },
      enum: {
        values: ['Petrol', 'Diesel', 'Hybrid', 'Electric'],
        message: '{VALUE} is not a valid fuel type. Must be one of: Petrol, Diesel, Hybrid, Electric',
      },
    },
    transmission: {
      type: String,
      required: [true, 'Transmission type is required'],
      trim: true,
      default: 'Automatic',
      set: (val: string) => {
        if (!val || typeof val !== 'string') return val;
        const trimmed = val.trim();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      },
      enum: {
        values: ['Automatic', 'Manual'],
        message: '{VALUE} is not a valid transmission type. Must be Automatic or Manual',
      },
    },
    seats: {
      type: Number,
      required: [true, 'Number of seats is required'],
      min: [1, 'Number of seats must be at least 1'],
    },
    images: {
      type: [String],
      default: [],
      set: (val: any) => {
        if (typeof val === 'string') {
          return val.trim() ? [val.trim()] : [];
        }
        if (Array.isArray(val)) {
          return val.map((item) => String(item).trim()).filter(Boolean);
        }
        return [];
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property for backward compatibility with status checks
carSchema.virtual('status').get(function () {
  return this.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
});

export const Car = model<ICar>('Car', carSchema);
export default Car;