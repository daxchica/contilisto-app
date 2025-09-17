// api/gpt.ts

import express from "express";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config(); // Cargar variables de entorno

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 👈 esta es la clave segura
});

// Endpoint POST para recibir texto y RUC
router.use(cors());
router.post("/gpt", async (req, res) => {
  const { fullText, entityRUC } = req.body;

  if (!fullText || !entityRUC) {
    return res.status(400).json({ error: "Missing data" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = `Eres un asistente contable...`; // igual que antes
  const userPrompt = `RUC entidad: ${entityRUC}\nTexto OCR:\n${fullText}\nHoy: ${today}`;

  try {
    const raw = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const result = raw.choices?.[0]?.message?.content || "";
    res.json({ result });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "Error calling OpenAI" });
  }
});

export default router;