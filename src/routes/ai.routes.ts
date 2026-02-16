import { Router, Request, Response } from "express";
import OpenAI from "openai";

import { authMiddleware } from "../middleware/authMiddleware";
import {
  getProfileByToken,
  getMaxBarOrder,
  createTextBar,
  invalidateProfileBarsCache,
} from "../utils/mainServiceClient";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const router = Router();

// POST /api/v1/ai/generate
router.post("/generate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Prompt is required and must be a string",
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
    });

    const generatedText = response.choices[0]?.message?.content;

    if (!generatedText) {
      return res.status(500).json({ error: "Failed to generate response" });
    }

    return res.status(200).json({
      success: true,
      data: {
        prompt: prompt,
        response: generatedText,
        model: "gpt-4o-mini-search",
      },
    });
  } catch (error) {
    console.error("Error generating response:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/v1/ai/generate/profile
// Calls korner-main-service to get profile and create bars
router.post("/generate/profile", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    const token = req.headers.authorization?.split(" ")[1] || "";

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required and must be a string" });
    }

    // Get profile from main service
    const currentProfile = await getProfileByToken(token);
    if (!currentProfile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const searchPrompt = `${prompt}

Please provide detailed information about this person, including their full name, profession, achievements, and background. Focus on factual information from reliable sources.`;

    const detailsResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini-search-preview",
      messages: [{ role: "user", content: searchPrompt }],
      max_tokens: 1000,
    });

    const detailsText = detailsResponse.choices[0]?.message?.content;

    if (!detailsText) {
      return res.status(500).json({ error: "Failed to get information about the person" });
    }

    const structuredInfoPrompt = `
На основе этой информации о человеке создайте структурированную информацию для создания информационных блоков:

"${detailsText}"

Создайте JSON со списком информационных блоков. Каждый блок должен содержать:
- title: заголовок блока
- description: краткое описание (максимум 150 символов)

ВАЖНО:
1. Верните ТОЛЬКО валидный JSON массив без markdown форматирования
2. Максимум 3-4 блока
3. На том же языке что и исходная информация
4. Информативные и краткие описания

Пример формата:
[
  {"title": "Профессия", "description": "Описание профессиональной деятельности"},
  {"title": "Достижения", "description": "Основные достижения и успехи"}
]`;

    const structuredResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: structuredInfoPrompt }],
      max_tokens: 300,
      temperature: 0.2,
    });

    const structuredText = structuredResponse.choices[0]?.message?.content?.trim() || "[]";

    let structuredBlocks;
    try {
      let cleanedResponse = structuredText;
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/, "").replace(/\n?```$/, "");
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.replace(/```\n?/, "").replace(/\n?```$/, "");
      }
      structuredBlocks = JSON.parse(cleanedResponse.trim());
    } catch {
      structuredBlocks = [{ title: "Информация", description: detailsText.substring(0, 150) }];
    }

    // Get max bar order from main service
    const nextOrder = await getMaxBarOrder(currentProfile.id, token);

    // Create bars via main service
    const createdBars = [];
    for (let i = 0; i < structuredBlocks.length; i++) {
      const block = structuredBlocks[i];

      const bar = await createTextBar(
        {
          profileId: currentProfile.id,
          type: "Text",
          title: block.title,
          size: "bun",
          order: nextOrder + i,
          status: "active",
          price: null,
          thumbnail: null,
          details: {
            textAlign: "text-left",
            headerPosition: "top",
            link: "",
            description: block.description,
            textTheme: {
              textColor: "#000000",
              backgroundColor: "#ffffff",
              linkBackgroundColor: "#f0f0f0",
            },
          },
          monetizedDetails: { price: null, currencyCode: null, isAdult: false },
          isMonetized: false,
        },
        token
      );
      createdBars.push(bar);
    }

    // Invalidate cache
    await invalidateProfileBarsCache(currentProfile.id, token);

    return res.status(200).json({
      success: true,
      message: "Text bars created successfully",
      data: {
        profile: currentProfile,
        createdBars,
        structuredBlocks,
        aiResponse: detailsText,
      },
    });
  } catch (error) {
    console.error("Error creating text bars with AI:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;