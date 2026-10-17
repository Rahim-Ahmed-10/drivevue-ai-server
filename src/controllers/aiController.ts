import { Request, Response } from 'express';
import Car from '../models/Car';
import { generateAiRecommendation } from '../config/gemini';

interface AiRecommendationItem {
  carId: string;
  reason: string;
}

interface AiResponsePayload {
  recommendation: string;
  recommendedCars: AiRecommendationItem[];
}

/**
 * Controller: Get AI-powered smart car recommendations based on user prompt
 * POST /api/ai/recommend
 */
export const getAiRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const prompt = req.body.prompt || req.body.query;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        status: 'error',
        success: false,
        message: 'Please provide a "prompt" in the request body describing your rental needs.',
      });
      return;
    }

    // 1. Fetch available cars from MongoDB
    const availableCars = await Car.find({ isAvailable: true }).lean();

    if (!availableCars || availableCars.length === 0) {
      res.status(200).json({
        status: 'success',
        success: true,
        recommendation: 'Currently, there are no cars available in our fleet.',
        matchingCars: [],
        totalMatches: 0,
      });
      return;
    }

    // 2. Prepare concise dataset for Gemini AI
    const carCatalog = availableCars.map((car) => ({
      id: car._id.toString(),
      name: car.name,
      brand: car.brand,
      model: car.model,
      year: car.year,
      pricePerDay: car.pricePerDay,
      category: car.category,
      fuelType: car.fuelType,
      transmission: car.transmission,
      seats: car.seats,
    }));

    // 3. Construct system prompt for Gemini
    const systemPrompt = `You are DriveVue AI, an intelligent vehicle rental recommendation assistant.
Analyze the user's travel requirements, budget, group size, and style preferences, and recommend the best vehicles from our available fleet.

Available Vehicle Inventory:
${JSON.stringify(carCatalog, null, 2)}

Instructions:
1. Select 1 to 4 cars from the provided inventory that best match the user's query.
2. For each recommended car, use its exact "id" from the inventory and write a brief, compelling reason explaining why it fits.
3. Write a warm, professional "recommendation" summary message addressing the user directly.
4. Output STRICTLY a valid JSON object matching this schema without any markdown wrapper:
{
  "recommendation": "Overall advice explaining why these choices fit the user's trip",
  "recommendedCars": [
    {
      "carId": "exact vehicle id string",
      "reason": "Specific reason why this vehicle matches"
    }
  ]
}`;

    let parsedResult: AiResponsePayload | null = null;

    try {
      // 4. Generate recommendation with Gemini
      const aiResponse = await generateAiRecommendation({
        contents: prompt.trim(),
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      });

      const responseText = aiResponse.text || '';
      // Clean potential markdown blocks if present
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (aiError: any) {
      console.warn('[Gemini AI] API call failed, falling back to rule-based matching:', aiError.message);
    }

    // 5. Structure matching cars with AI reasoning
    let matchingCars: any[] = [];
    let recommendationSummary = '';

    if (parsedResult && Array.isArray(parsedResult.recommendedCars) && parsedResult.recommendedCars.length > 0) {
      recommendationSummary = parsedResult.recommendation;

      matchingCars = parsedResult.recommendedCars
        .map((rec) => {
          const car = availableCars.find(
            (c) => c._id.toString() === String(rec.carId) || c.name.toLowerCase().includes(String(rec.carId).toLowerCase())
          );
          if (!car) return null;
          return {
            ...car,
            aiReason: rec.reason,
          };
        })
        .filter(Boolean);
    }

    // Fallback: If AI recommendation produced no match or AI was offline, match heuristically
    if (matchingCars.length === 0) {
      const lowerPrompt = prompt.toLowerCase();
      matchingCars = availableCars
        .filter((car) => {
          return (
            lowerPrompt.includes(car.category.toLowerCase()) ||
            lowerPrompt.includes(car.fuelType.toLowerCase()) ||
            lowerPrompt.includes(car.brand.toLowerCase()) ||
            lowerPrompt.includes(car.name.toLowerCase()) ||
            (lowerPrompt.includes('family') && car.seats >= 5) ||
            (lowerPrompt.includes('budget') && car.pricePerDay <= 100) ||
            (lowerPrompt.includes('luxury') && (car.category === 'Luxury' || car.category === 'Sports'))
          );
        })
        .map((car) => ({
          ...car,
          aiReason: `Selected based on your criteria (${car.category}, ${car.seats} seats, $${car.pricePerDay}/day).`,
        }));

      // If still empty, return top 2 available cars
      if (matchingCars.length === 0) {
        matchingCars = availableCars.slice(0, 2).map((car) => ({
          ...car,
          aiReason: `Popular rental choice in our fleet ($${car.pricePerDay}/day).`,
        }));
      }

      if (!recommendationSummary) {
        recommendationSummary = `Based on your request "${prompt}", here are the best matching vehicles from our fleet:`;
      }
    }

    res.status(200).json({
      status: 'success',
      success: true,
      prompt: prompt.trim(),
      recommendation: recommendationSummary,
      matchingCars,
      totalMatches: matchingCars.length,
    });
  } catch (error: any) {
    console.error('[getAiRecommendations Error]:', error);
    res.status(500).json({
      status: 'error',
      success: false,
      message: error.message || 'Failed to process AI recommendations.',
    });
  }
};
