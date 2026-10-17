import { Router } from 'express';
import { getCars, getCarById, createCar } from '../controllers/carController';
import { protect, authorize } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', getCars);
router.get('/:id', getCarById);
router.post('/', protect, authorize('ADMIN'), createCar);

export default router;
