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

// Preferred Gemini model; supports gemini-3.8-flash, gemini-2.5-flash, gemini-2.0-flash, or gemini-1.5-flash
export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const FALLBACK_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

/**
 * Helper function to generate content using Google Gemini AI with automatic model fallback
 */
export const generateAiRecommendation = async (params: {
  contents: string;
  systemInstruction?: string;
  responseMimeType?: string;
  model?: string;
}) => {
  const candidateModels = [
    params.model || DEFAULT_GEMINI_MODEL,
    ...FALLBACK_GEMINI_MODELS.filter((m) => m !== (params.model || DEFAULT_GEMINI_MODEL)),
  ];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: params.responseMimeType,
        },
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini AI] Model "${model}" failed, trying next candidate...`);
    }
  }

  throw lastError;
};

export default aiClient;
