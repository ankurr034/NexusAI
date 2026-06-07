import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requirePremium } from '../middleware/auth.js';

const router = express.Router();
router.use(requirePremium);


const API_KEY = process.env.GEMINI_API_KEY;
let genAI;
let model;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // or gemini-pro
}

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!model) {
      // Fallback if API key isn't provided
      return res.json({
        title: "Mock AI Response",
        verdict: "HOLD",
        body: "Gemini API key is not configured. This is a simulated response.\n\n**Risk:** Medium\n**Recommendation:** Wait for API integration.",
        symbol: "MOCK",
        price: 100.0,
        change_pct: 0.0,
        confidence: 50
      });
    }

    const prompt = `
You are a senior financial analyst and AI trading copilot. 
User query: "${message}"

Respond strictly in the following JSON format without any markdown blocks or extra text:
{
  "title": "Short title of analysis",
  "verdict": "BUY" | "SELL" | "HOLD" | "STRONG BUY" | "ERROR",
  "body": "Detailed HTML or markdown formatted explanation. Include Risk assessment and key levels. Use **bold** for emphasis.",
  "symbol": "Ticker symbol if identified, else null",
  "price": Estimated target or current price as a number,
  "change_pct": Expected % change,
  "confidence": Confidence percentage (0-100)
}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse JSON
    let parsedResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = JSON.parse(responseText);
      }
    } catch (parseErr) {
      console.error("Failed to parse Gemini response:", responseText);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json(parsedResponse);
  } catch (error) {
    console.error('Error in AI Chat:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

export default router;
