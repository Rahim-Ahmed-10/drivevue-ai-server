import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Car from '../models/Car';

/**
 * 1. Create a new car (Admin only)
 * POST /api/cars
 */
export const createCar = async (req: Request, res: Response): Promise<void> => {
  console.log('[createCar] Incoming request headers:', {
    authorization: req.headers.authorization ? 'Bearer [PRESENT]' : 'NONE',
    'content-type': req.headers['content-type'],
  });
  console.log('[createCar] Incoming payload:', JSON.stringify(req.body, null, 2));

  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      console.warn('[createCar] Empty or invalid request body');
      res.status(400).json({
        status: 'error',
        success: false,
        message: 'Request body cannot be empty. Please provide JSON payload with Content-Type: application/json',
      });
      return;
    }

    const {
      name,
      brand,
      model,
      year,
      pricePerDay,
      category,
      fuelType,
      transmission,
      seats,
      images,
      isAvailable,
    } = req.body;

    // Detailed field-level validation
    const validationErrors: Record<string, string> = {};

    if (!name || (typeof name === 'string' && !name.trim())) {
      validationErrors['name'] = 'Car name is required';
    }
    if (!brand || (typeof brand === 'string' && !brand.trim())) {
      validationErrors['brand'] = 'Car brand is required';
    }
    if (!model || (typeof model === 'string' && !model.trim())) {
      validationErrors['model'] = 'Car model is required';
    }
    if (year === undefined || year === null || year === '') {
      validationErrors['year'] = 'Manufacturing year is required';
    } else if (isNaN(Number(year))) {
      validationErrors['year'] = `Year must be a valid number, received: "${year}"`;
    }
    if (pricePerDay === undefined || pricePerDay === null || pricePerDay === '') {
      validationErrors['pricePerDay'] = 'Price per day is required';
    } else if (isNaN(Number(pricePerDay)) || Number(pricePerDay) < 0) {
      validationErrors['pricePerDay'] = `Price per day must be a non-negative number, received: "${pricePerDay}"`;
    }
    if (!category || (typeof category === 'string' && !category.trim())) {
      validationErrors['category'] = 'Category is required (Allowed: Sedan, SUV, Luxury, Electric, Sports)';
    }
    if (!fuelType || (typeof fuelType === 'string' && !fuelType.trim())) {
      validationErrors['fuelType'] = 'Fuel type is required (Allowed: Petrol, Diesel, Hybrid, Electric)';
    }
    if (seats === undefined || seats === null || seats === '') {
      validationErrors['seats'] = 'Number of seats is required';
    } else if (isNaN(Number(seats)) || Number(seats) < 1) {
      validationErrors['seats'] = `Seats must be at least 1, received: "${seats}"`;
    }

    if (Object.keys(validationErrors).length > 0) {
      console.warn('[createCar] Validation failed:', validationErrors);
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Validation failed: ${Object.values(validationErrors).join('; ')}`,
        errors: validationErrors,
      });
      return;
    }

    // Process images safely
    let processedImages: string[] = [];
    if (Array.isArray(images)) {
      processedImages = images.map((img) => String(img).trim()).filter(Boolean);
    } else if (typeof images === 'string' && images.trim()) {
      processedImages = [images.trim()];
    }

    const newCar: any = await Car.create({
      name: String(name).trim(),
      brand: String(brand).trim(),
      model: String(model).trim(),
      year: Number(year),
      pricePerDay: Number(pricePerDay),
      category: category as any,
      fuelType: fuelType as any,
      transmission: (transmission ? String(transmission).trim() : 'Automatic') as any,
      seats: Number(seats),
      images: processedImages,
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
    });

    console.log('[createCar] Car created successfully with ID:', newCar._id);

    res.status(201).json({
      status: 'success',
      success: true,
      message: 'Car added successfully',
      data: newCar,
    });
  } catch (error: any) {
    console.error('[createCar Error]:', error);

    // Mongoose ValidationError
    if (error.name === 'ValidationError') {
      const errorDetails: Record<string, string> = {};
      for (const field of Object.keys(error.errors)) {
        errorDetails[field] = error.errors[field].message;
      }
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Validation failed: ${Object.values(errorDetails).join('; ')}`,
        errors: errorDetails,
      });
      return;
    }

    // Mongoose CastError
    if (error.name === 'CastError') {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid value "${error.value}" for field "${error.path}". Expected type: ${error.kind}`,
        errors: {
          [error.path]: `Invalid value "${error.value}". Expected type: ${error.kind}`,
        },
      });
      return;
    }

    res.status(400).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to create car',
    });
  }
};

/**
 * 2. Get all cars with filtering and search (Public)
 * GET /api/cars?brand=...&category=...&fuelType=...&search=...&isAvailable=...
 */
export const getAllCars = async (req: Request, res: Response): Promise<void> => {
  try {
    const { brand, category, fuelType, search, isAvailable } = req.query;
    const query: any = {};

    // Filter by brand (case-insensitive exact match)
    if (brand) {
      query.brand = { $regex: new RegExp(`^${brand}$`, 'i') };
    }

    // Filter by category (case-insensitive exact match)
    if (category) {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    // Filter by fuelType (case-insensitive exact match)
    if (fuelType) {
      query.fuelType = { $regex: new RegExp(`^${fuelType}$`, 'i') };
    }

    // Filter by availability
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    // Search query matching across name, brand, or model
    if (search) {
      const searchRegex = { $regex: search as string, $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { brand: searchRegex },
        { model: searchRegex },
      ];
    }

    const cars = await Car.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      success: true,
      results: cars.length,
      count: cars.length,
      data: cars,
    });
  } catch (error: any) {
    console.error('[getAllCars Error]:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to fetch cars',
    });
  }
};

/**
 * 3. Get single car details by ID (Public)
 * GET /api/cars/:id
 */
export const getCarById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid car ID format: "${id}". Must be a valid 24-character hexadecimal ObjectId.`,
      });
      return;
    }

    const car = await Car.findById(id);
    if (!car) {
      res.status(404).json({
        status: 'error',
        success: false,
        message: `Car with ID "${id}" was not found`,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      success: true,
      data: car,
    });
  } catch (error: any) {
    console.error('[getCarById Error]:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to fetch car',
    });
  }
};

/**
 * 4. Update car info (Admin only)
 * PATCH /api/cars/:id or PUT /api/cars/:id
 */
export const updateCar = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    console.log(`[updateCar] Updating car ID: ${id}`);
    console.log('[updateCar] Update payload:', JSON.stringify(req.body, null, 2));

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid car ID format: "${id}". Must be a valid 24-character hexadecimal ObjectId.`,
      });
      return;
    }

    // Convert numeric fields if passed as strings
    const updateData = { ...req.body };
    if (updateData.year !== undefined && updateData.year !== null) {
      updateData.year = Number(updateData.year);
    }
    if (updateData.pricePerDay !== undefined && updateData.pricePerDay !== null) {
      updateData.pricePerDay = Number(updateData.pricePerDay);
    }
    if (updateData.seats !== undefined && updateData.seats !== null) {
      updateData.seats = Number(updateData.seats);
    }
    if (typeof updateData.images === 'string') {
      updateData.images = [updateData.images.trim()];
    }

    const updatedCar = await Car.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedCar) {
      res.status(404).json({
        status: 'error',
        success: false,
        message: `Car with ID "${id}" was not found`,
      });
      return;
    }

    console.log(`[updateCar] Car updated successfully: ${id}`);

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'Car updated successfully',
      data: updatedCar,
    });
  } catch (error: any) {
    console.error('[updateCar Error]:', error);

    if (error.name === 'ValidationError') {
      const errorDetails: Record<string, string> = {};
      for (const field of Object.keys(error.errors)) {
        errorDetails[field] = error.errors[field].message;
      }
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Validation failed: ${Object.values(errorDetails).join('; ')}`,
        errors: errorDetails,
      });
      return;
    }

    if (error.name === 'CastError') {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid value "${error.value}" for field "${error.path}". Expected type: ${error.kind}`,
        errors: {
          [error.path]: `Invalid value "${error.value}". Expected type: ${error.kind}`,
        },
      });
      return;
    }

    res.status(400).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to update car',
    });
  }
};

/**
 * 5. Delete car (Admin only)
 * DELETE /api/cars/:id
 */
export const deleteCar = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    console.log(`[deleteCar] Deleting car ID: ${id}`);

    if (!id || !Types.ObjectId.isValid(id)) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: `Invalid car ID format: "${id}". Must be a valid 24-character hexadecimal ObjectId.`,
      });
      return;
    }

    const deletedCar = await Car.findByIdAndDelete(id);

    if (!deletedCar) {
      res.status(404).json({
        status: 'error',
        success: false,
        message: `Car with ID "${id}" was not found`,
      });
      return;
    }

    console.log(`[deleteCar] Car deleted successfully: ${id}`);

    res.status(200).json({
      status: 'success',
      success: true,
      message: 'Car deleted successfully',
      data: deletedCar,
    });
  } catch (error: any) {
    console.error('[deleteCar Error]:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to delete car',
    });
  }
};

// Alias for backwards compatibility
export const getCars = getAllCars;