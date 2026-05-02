// api/gpt.ts

import express, { type Request, type Response } from "express";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

type GPTRequestBody = {
  fullText: string;
  entityRUC: string;
};

const router = express.Router();

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

router.use(cors());
router.use(express.json({ limit: "10mb" }));

router.post(
  "/gpt",
  async (
    req: Request<Record<string, never>, unknown, GPTRequestBody>,
    res: Response
  ) => {
    const { fullText, entityRUC } = req.body;

    if (!fullText?.trim() || !entityRUC?.trim()) {
      return res.status(400).json({
        error: "Missing required fields: fullText and entityRUC",
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `
Eres un asistente contable experto en Ecuador.
Analiza el texto OCR de una factura y determina si corresponde a venta o compra
comparando el RUC de la entidad con el RUC emisor del documento.
Devuelve únicamente JSON válido.
`.trim();

    const userPrompt = `
RUC entidad: ${entityRUC.trim()}
Fecha actual: ${today}

Texto OCR:
${fullText.trim()}
`.trim();

    try {
      const raw = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const result = raw.choices[0]?.message?.content ?? "";

      return res.status(200).json({ result });
    } catch (err) {
      console.error("OpenAI error:", err);

      return res.status(500).json({
        error: "Error calling OpenAI",
      });
    }
  }
);

export default router;