import https from "https";

import Replicate, { Prediction } from "replicate";

import { uploadToBothBuckets } from "../../utils/s3.utils";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

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
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const contentType = defaultInput.output_format === "jpg" ? "image/jpeg" : "image/png";
            const s3Url = await uploadToBothBuckets("iamkj", buffer, filename, contentType);
            resolve(s3Url);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", (err) => reject(err));
  });
};

export const replicateService = {
  async generateImage(userId: number, body: {
    prompt?: string;
    title?: string;
    aspect_ratio?: string;
    output_format?: string;
    safety_filter_level?: string;
  }) {
    const { prompt, title, aspect_ratio, output_format, safety_filter_level } = body;

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

    return { prediction, finalPrompt, title: title || null, userId, webhookUrl };
  },

  async handleWebhook(predictionId: string, status: string, output: any, error: any) {
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
  },

  async generate(model: string, input: unknown) {
    return replicate.run(model, { input });
  },

  async listModels() {
    return replicate.models.list();
  },

  async checkPrediction(predictionId: string, userId: number) {
    const prediction: Prediction = await replicate.predictions.get(predictionId);

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

    return { prediction, s3Url };
  },
};
