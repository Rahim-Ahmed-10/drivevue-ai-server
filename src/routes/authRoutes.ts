import { Router, Request, Response } from 'express';
import { registerUser, loginUser, seedDemoUsers, seedAdmin } from '../controllers/authController';

const router = Router();

// Primary authentication routes (POST)
router.post('/register', registerUser);
router.post('/login', loginUser);

// Demo / Seed Users Routes (supports both POST and GET for browser and API convenience)
router.post('/seed-users', seedDemoUsers);
router.get('/seed-users', seedDemoUsers);
router.post('/seed-demo', seedDemoUsers);
router.get('/seed-demo', seedDemoUsers);
router.post('/seed-admin', seedAdmin);
router.get('/seed-admin', seedAdmin);

// Informative fallback for accidental GET requests (e.g. from a browser)
router.get('/login', (_req: Request, res: Response) => {
  res.status(405).json({
    status: 'error',
    message: 'Method Not Allowed: /api/auth/login requires a POST request with JSON body { email, password }.',
  });
});

router.get('/register', (_req: Request, res: Response) => {
  res.status(405).json({
    status: 'error',
    message: 'Method Not Allowed: /api/auth/register requires a POST request with JSON body { name, email, password, role? }.',
  });
});

export default router;
