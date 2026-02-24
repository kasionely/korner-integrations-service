import { Request, Response } from "express";

import { webhookService } from "./webhook.service";

export async function vercel(req: Request, res: Response): Promise<void> {
  try {
    await webhookService.handleVercelWebhook(req.body);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    if (error.statusCode === 400) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function testTeamBot(req: Request, res: Response): Promise<void> {
  try {
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    await webhookService.handleTestTeamBot(message);
    res.status(200).json({ success: true, message: "Test message sent" });
  } catch (error) {
    console.error("Test team bot error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function teamBot(req: Request, res: Response): Promise<void> {
  try {
    await webhookService.handleTeamBot(req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Team bot webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getMessages(req: Request, res: Response): Promise<void> {
  try {
    const { chatId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const data = await webhookService.getTeamBotMessages(chatId, limit);
    res.status(200).json(data);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
}

export async function dailyReminder(req: Request, res: Response): Promise<void> {
  try {
    await webhookService.sendDailyReminder();
    res.status(200).json({ success: true, message: "Daily reminder sent successfully" });
  } catch (error) {
    console.error("Manual daily reminder error:", error);
    res.status(500).json({
      error: "Failed to send daily reminder",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
