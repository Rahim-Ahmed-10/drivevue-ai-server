import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Car from '../models/Car';

const carsData = [
  {
    name: "Tesla Model S Plaid",
    brand: "Tesla",
    model: "Model S",
    year: 2024,
    pricePerDay: 189,
    category: "Electric",
    fuelType: "Electric",
    transmission: "Automatic",
    seats: 5,
    images: [
      "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
  {
    name: "Porsche Taycan 4S",
    brand: "Porsche",
    model: "Taycan 4S",
    year: 2024,
    pricePerDay: 245,
    category: "Electric",
    fuelType: "Electric",
    transmission: "Automatic",
    seats: 4,
    images: [
      "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
  {
    name: "Mercedes-Benz S 580 4MATIC",
    brand: "Mercedes-Benz",
    model: "S-Class",
    year: 2024,
    pricePerDay: 250,
    category: "Luxury",
    fuelType: "Hybrid",
    transmission: "Automatic",
    seats: 5,
    images: [
      "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
  {
    name: "BMW X5 xDrive40i",
    brand: "BMW",
    model: "X5",
    year: 2023,
    pricePerDay: 150,
    category: "SUV",
    fuelType: "Petrol",
    transmission: "Automatic",
    seats: 7,
    images: [
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
  {
    name: "Porsche 911 Carrera S",
    brand: "Porsche",
    model: "911 Carrera",
    year: 2023,
    pricePerDay: 320,
    category: "Sports",
    fuelType: "Petrol",
    transmission: "Manual",
    seats: 4,
    images: [
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
  {
    name: "Range Rover Sport Dynamic",
    brand: "Range Rover",
    model: "Sport",
    year: 2024,
    pricePerDay: 210,
    category: "SUV",
    fuelType: "Hybrid",
    transmission: "Automatic",
    seats: 7,
    images: [
      "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
  {
    name: "Audi RS e-tron GT",
    brand: "Audi",
    model: "e-tron GT",
    year: 2024,
    pricePerDay: 230,
    category: "Electric",
    fuelType: "Electric",
    transmission: "Automatic",
    seats: 5,
    images: [
      "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
  {
    name: "Lamborghini Urus Performante",
    brand: "Lamborghini",
    model: "Urus",
    year: 2024,
    pricePerDay: 450,
    category: "Sports",
    fuelType: "Petrol",
    transmission: "Automatic",
    seats: 5,
    images: [
      "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
  {
    name: "Tesla Model 3 Performance",
    brand: "Tesla",
    model: "Model 3",
    year: 2023,
    pricePerDay: 120,
    category: "Electric",
    fuelType: "Electric",
    transmission: "Automatic",
    seats: 5,
    images: [
      "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80",
    ],
    isAvailable: true,
    status: "AVAILABLE",
  },
];

async function seedCars() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drivevue-ai';
  try {
    await mongoose.connect(mongoUri, { dbName: 'drivevue-ai' });
    const count = await Car.countDocuments();
    if (count === 0) {
      console.log('[Atlas Car Seed] Seeding fleet cars into Atlas...');
      await Car.insertMany(carsData);
      console.log(`[Atlas Car Seed] Successfully seeded ${carsData.length} cars!`);
    } else {
      console.log(`[Atlas Car Seed] Database already contains ${count} cars.`);
    }
  } catch (err) {
    console.error('[Atlas Car Seed Error]', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedCars();
