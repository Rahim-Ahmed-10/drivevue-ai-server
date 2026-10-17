import { Router } from 'express';
import { getAiRecommendations } from '../controllers/aiController';

const router = Router();

// POST /api/ai/recommend
router.post('/recommend', getAiRecommendations);

export default router;
