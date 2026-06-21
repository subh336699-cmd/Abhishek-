import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Lazy initialize client to fail gracefully if key is missing when endpoints are called
  const getGeminiClient = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  app.use(express.json());

  app.post('/api/gemini/generate-report', async (req, res) => {
    try {
      const { activeData } = req.body;
      if (!activeData || !Array.isArray(activeData)) {
        return res.status(400).json({ error: 'Missing activeData array' });
      }

      if (activeData.length === 0) {
        return res.json({ text: 'No active logs to report on yet.' });
      }

      const prompt = `You are an expert logistics and operations coordinator. Generate a concise, professional end-of-shift report based on the following log entries. Summarize the total arrivals, departures, currently occupied boxes, and clearly highlight any important notes or anomalies from the comments. Use clear spacing and bullet points.\n\nLog Data: ${JSON.stringify(activeData)}`;

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error generating report:', error);
      res.status(500).json({ error: error.message || 'Failed to generate report' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
