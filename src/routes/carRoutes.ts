import { Router } from 'express';
import {
  createCar,
  getAllCars,
  getCarById,
  updateCar,
  deleteCar,
} from '../controllers/carController';
import { verifyToken, verifyAdmin } from '../middlewares/authMiddleware';

const router = Router();

// Public routes: Anyone can browse and view car details
router.get('/', getAllCars);
router.get('/:id', getCarById);

// Protected routes: Only ADMIN users can create, update, and delete cars (RBAC Protected)
router.post('/', verifyToken, verifyAdmin, createCar);
router.patch('/:id', verifyToken, verifyAdmin, updateCar);
router.put('/:id', verifyToken, verifyAdmin, updateCar);
router.delete('/:id', verifyToken, verifyAdmin, deleteCar);

export default router;
