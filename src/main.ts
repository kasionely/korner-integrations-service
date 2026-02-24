import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";

dotenv.config();

import aiRoutes from "./modules/ai/ai.routes";
import replicateRoutes from "./modules/replicate/replicate.routes";
import webhookRoutes from "./modules/webhook/webhook.routes";
import { dailyReminderService } from "./services/dailyReminder.service";

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
const allowedOrigins = [
  "https://korner.pro",
  "https://korner.lol",
  "https://arsentomsky.indrive.com",
  "http://localhost:6969",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "korner-integrations-service" });
});

// Routes
app.use("/api/ai", aiRoutes);
app.use("/api/replicate", replicateRoutes);
app.use("/api/webhook", webhookRoutes);

// Start daily reminder service (dev only)
if (process.env.ACTIVE_ENV === "dev") {
  dailyReminderService.start();
}

// Generic error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      code: "SERVER_ERROR",
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    },
  });
});

app.listen(Number(PORT), () => {
  console.log(`korner-integrations-service running on port ${PORT}`);
});

export default app;