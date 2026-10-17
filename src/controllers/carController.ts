import { Request, Response } from 'express';
import Car from '../models/Car';

export const getCars = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, status } = req.query;
    const filter: Record<string, any> = {};

    if (category) filter.category = category;
    if (status) filter.status = status;

    const cars = await Car.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: cars.length,
      data: cars,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCarById = async (req: Request, res: Response): Promise<void> => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      res.status(404).json({ success: false, message: 'Car not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: car,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCar = async (req: Request, res: Response): Promise<void> => {
  try {
    const car = await Car.create(req.body);

    res.status(201).json({
      success: true,
      data: car,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
