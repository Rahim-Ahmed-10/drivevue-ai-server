import { Router } from 'express';
import {
  createCar,
  getAllCars,
  getCarById,
  updateCar,
  deleteCar,
} from '../controllers/carController';
import { verifyToken, authorizeRoles } from '../middlewares/authMiddleware';

const router = Router();

// Public routes: Anyone can browse and view car details
router.get('/', getAllCars);
router.get('/:id', getCarById);

// Protected routes: Only ADMIN users can create, update, and delete cars
router.post('/', verifyToken, authorizeRoles('ADMIN'), createCar);
router.patch('/:id', verifyToken, authorizeRoles('ADMIN'), updateCar);
router.put('/:id', verifyToken, authorizeRoles('ADMIN'), updateCar);
router.delete('/:id', verifyToken, authorizeRoles('ADMIN'), deleteCar);

export default router;
