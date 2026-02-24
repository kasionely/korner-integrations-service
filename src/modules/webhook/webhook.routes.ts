import { Router } from "express";

import * as webhookController from "./webhook.controller";

const router = Router();

router.post("/vercel", webhookController.vercel);
router.post("/test-team-bot", webhookController.testTeamBot);
router.post("/team-bot", webhookController.teamBot);
router.get("/team-bot/messages/:chatId", webhookController.getMessages);
router.post("/daily-reminder", webhookController.dailyReminder);

export default router;
