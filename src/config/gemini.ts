import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey && process.env.NODE_ENV !== 'test') {
  console.warn('[Gemini AI] Warning: GEMINI_API_KEY is not set in environment variables.');
}

export const aiClient = new GoogleGenAI({
  apiKey,
});

export default aiClient;
