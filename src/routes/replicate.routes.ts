import https from "https";
import { Router, Request, Response } from "express";
import Replicate, { Prediction } from "replicate";

import { authMiddleware } from "../middleware/authMiddleware";
import { uploadToBothBuckets } from "../utils/s3.utils";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const router = Router();

const defaultInput = {
  prompt: `Generate a cinematic warm gradient background inspired by sunset tones — golden orange, rose pink, and soft violet. Overlay the Russian word "Обо мне" in elegant serif font with subtle glow and depth. Add light grain and soft vignette for a nostalgic yet professional atmosphere.`,
  aspect_ratio: "16:9",
  output_format: "jpg",
  safety_filter_level: "block_none",
};

const downloadAndUploadToS3 = async (url: string, filename: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const contentType =
              defaultInput.output_format === "jpg" ? "image/jpeg" : "image/png";
            const s3Url = await uploadToBothBuckets("iamkj", buffer, filename, contentType);
            resolve(s3Url);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

// POST /api/v1/replicate/generate-image
router.post("/generate-image", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { prompt, title, aspect_ratio, output_format, safety_filter_level } = req.body;

    const defaultPrompt = title
      ? `Generate a cinematic warm gradient background inspired by sunset tones — golden orange, rose pink, and soft violet. Overlay the text "${title}" in elegant serif font with subtle glow and depth. Add light grain and soft vignette for a nostalgic yet professional atmosphere.`
      : defaultInput.prompt;

    const finalPrompt = prompt && typeof prompt === "string" ? prompt : defaultPrompt;

    const predictionInput = {
      prompt: finalPrompt,
      aspect_ratio: aspect_ratio || "16:9",
      output_format: output_format || "jpg",
      safety_filter_level: safety_filter_level || "block_only_high",
    };

    const webhookUrl = `${process.env.API_URL || "http://localhost:3005"}/api/v1/replicate/webhook`;

    const prediction: Prediction = await replicate.predictions.create({
      version: "4e5534950275f5d29aa1ea263a442018f34d90254bb89ba9a08de44bc68c5a33",
      input: predictionInput,
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    });

    return res.status(202).json({
      success: true,
      data: {
        prediction_id: prediction.id,
        status: prediction.status,
        model: "google/imagen-4-fast",
        prompt: finalPrompt,
        title: title || null,
        userId: userId,
        webhook_url: webhookUrl,
      },
    });
  } catch (error) {
    console.error("Error creating prediction:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// POST /api/v1/replicate/webhook
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const { id: predictionId, status, output, error } = req.body;

    if (!predictionId) {
      return res.status(400).json({ error: "No prediction ID provided" });
    }

    console.log(`Processing webhook for prediction ${predictionId} with status ${status}`);

    if (status === "succeeded" && output) {
      let imageUrl: string | null = null;

      if (Array.isArray(output) && output.length > 0) {
        imageUrl = output[0];
      } else if (typeof output === "string") {
        imageUrl = output;
      }

      if (imageUrl) {
        try {
          const timestamp = Date.now();
          const filename = `replicate/webhook_${predictionId}_${timestamp}.jpg`;
          const s3Url = await downloadAndUploadToS3(imageUrl, filename);
          console.log(`Image uploaded to S3: ${s3Url}`);
        } catch (s3Error) {
          console.error("Error uploading to S3:", s3Error);
        }
      }
    } else if (status === "failed" && error) {
      console.error(`Prediction ${predictionId} failed:`, error);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/v1/replicate/generate
router.post("/generate", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { model, input } = req.body;

    if (!model || !input) {
      return res.status(400).json({ error: "Model and input are required" });
    }

    const output = await replicate.run(model, { input });

    return res.status(200).json({
      success: true,
      data: { model, input, output },
    });
  } catch (error) {
    console.error("Error generating with Replicate:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/v1/replicate/models
router.get("/models", authMiddleware, async (req: Request, res: Response) => {
  try {
    const models = await replicate.models.list();
    return res.status(200).json({ success: true, data: models });
  } catch (error) {
    console.error("Error fetching models:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/v1/replicate/check-prediction/:id
router.get("/check-prediction/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.auth?.userId;

    const prediction: Prediction = await replicate.predictions.get(id);

    let s3Url: string | null = null;

    if (prediction.status === "succeeded" && prediction.output) {
      let imageUrl: string | null = null;

      if (Array.isArray(prediction.output) && prediction.output.length > 0) {
        imageUrl = prediction.output[0] as string;
      } else if (typeof prediction.output === "string") {
        imageUrl = prediction.output;
      }

      if (imageUrl) {
        try {
          const timestamp = Date.now();
          const filename = `replicate/imagen_${userId}_${timestamp}.jpg`;
          s3Url = await downloadAndUploadToS3(imageUrl, filename);
          console.log("Image uploaded to S3:", s3Url);
        } catch (s3Error) {
          console.error("Error uploading to S3:", s3Error);
        }
      }
    }

    return res.status(200).json({
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
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
