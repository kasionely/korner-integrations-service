import { Router } from "express";

import { authMiddleware } from "../../middleware/authMiddleware";
import * as replicateController from "./replicate.controller";

const router = Router();

router.post("/generate-image", authMiddleware, replicateController.generateImage);
router.post("/webhook", replicateController.webhook);
router.post("/generate", authMiddleware, replicateController.generate);
router.get("/models", authMiddleware, replicateController.listModels);
router.get("/check-prediction/:id", authMiddleware, replicateController.checkPrediction);

export default router;
