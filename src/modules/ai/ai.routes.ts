import { Router } from "express";

import { authMiddleware } from "../../middleware/authMiddleware";
import * as aiController from "./ai.controller";

const router = Router();

router.post("/generate", authMiddleware, aiController.generate);
router.post("/generate/profile", authMiddleware, aiController.generateProfile);

export default router;
