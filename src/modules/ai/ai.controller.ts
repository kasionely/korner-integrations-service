import { Request, Response } from "express";

import { aiService } from "./ai.service";

export async function generate(req: Request, res: Response): Promise<void> {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Prompt is required and must be a string" });
    return;
  }

  try {
    const data = await aiService.generate(prompt);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error generating response:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function generateProfile(req: Request, res: Response): Promise<void> {
  const { prompt } = req.body;
  const token = req.headers.authorization?.split(" ")[1] || "";

  if (!prompt || typeof prompt !== "string") {
    res.status(400).json({ error: "Prompt is required and must be a string" });
    return;
  }

  try {
    const data = await aiService.generateProfile(prompt, token);
    res.status(200).json({ success: true, message: "Text bars created successfully", data });
  } catch (error: any) {
    console.error("Error creating text bars with AI:", error);
    if (error.statusCode === 404) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" });
  }
}
