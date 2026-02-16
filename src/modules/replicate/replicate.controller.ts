import { Request, Response } from "express";

import { replicateService } from "./replicate.service";

export async function generateImage(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "User not authenticated" });
    return;
  }

  try {
    const result = await replicateService.generateImage(userId, req.body);
    res.status(202).json({
      success: true,
      data: {
        prediction_id: result.prediction.id,
        status: result.prediction.status,
        model: "google/imagen-4-fast",
        prompt: result.finalPrompt,
        title: result.title,
        userId: result.userId,
        webhook_url: result.webhookUrl,
      },
    });
  } catch (error) {
    console.error("Error creating prediction:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function webhook(req: Request, res: Response): Promise<void> {
  const { id: predictionId, status, output, error } = req.body;

  if (!predictionId) {
    res.status(400).json({ error: "No prediction ID provided" });
    return;
  }

  try {
    await replicateService.handleWebhook(predictionId, status, output, error);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error processing webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function generate(req: Request, res: Response): Promise<void> {
  const { model, input } = req.body;

  if (!model || !input) {
    res.status(400).json({ error: "Model and input are required" });
    return;
  }

  try {
    const output = await replicateService.generate(model, input);
    res.status(200).json({ success: true, data: { model, input, output } });
  } catch (error) {
    console.error("Error generating with Replicate:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function listModels(req: Request, res: Response): Promise<void> {
  try {
    const models = await replicateService.listModels();
    res.status(200).json({ success: true, data: models });
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" });
  }
}

export async function checkPrediction(req: Request, res: Response): Promise<void> {
  const userId = req.auth?.userId;
  const { id } = req.params;

  try {
    const { prediction, s3Url } = await replicateService.checkPrediction(id, userId!);
    res.status(200).json({
      success: true,
      data: {
        id: prediction.id,
        status: prediction.status,
        output: prediction.output,
        error: prediction.error,
        s3_url: s3Url,
        created_at: prediction.created_at,
        completed_at: prediction.completed_at,
      },
    });
  } catch (error) {
    console.error("Error checking prediction:", error);
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" });
  }
}
