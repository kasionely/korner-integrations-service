import axios from "axios";

import { dailyReminderService } from "../../services/dailyReminder.service";
import { briefService } from "../../services/brief.service";
import { askDeepSeek, summarizeMessages } from "../../utils/neurorouters";
import redis from "../../utils/redis";

const MAX_STORED_MESSAGES = 1000;
const MESSAGES_KEY_PREFIX = "chat_messages:";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TEAM_TELEGRAM_BOT_TOKEN = process.env.TEAM_TELEGRAM_BOT_TOKEN;
const TEAM_TELEGRAM_CHAT_ID = process.env.TEAM_TELEGRAM_CHAT_ID;

export const webhookService = {
  async handleVercelWebhook(body: any) {
    const { type, payload } = body;
    const deployment = payload?.deployment;

    if (!deployment) {
      throw Object.assign(new Error("Invalid payload"), { statusCode: 400 });
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error("Telegram configuration missing");
    }

    const { name, meta } = deployment;
    let message;

    switch (type) {
      case "deployment.created":
        message = `🚀 Deploy started for *${name}*`;
        break;
      case "deployment.succeeded": {
        const branch = meta?.githubCommitRef;
        const environment = branch === "main" ? "production" : "development";

        let siteUrl;
        if (name === "korner-admin-front") {
          siteUrl = branch === "main" ? "admin.korner.pro" : "admin.korner.lol";
        } else {
          siteUrl = branch === "main" ? "korner.pro" : "korner.lol";
        }

        message = `✅ Deploy completed for *${name}* (${environment})\n🔗 https://${siteUrl}`;
        if (meta?.githubCommitMessage) {
          message += `\n📝 ${meta.githubCommitMessage}`;
        }
        if (meta?.githubCommitAuthorName) {
          message += `\n👤 ${meta.githubCommitAuthorName}`;
        }
        if (branch) {
          message += `\n🌿 Branch: ${branch}`;
        }
        break;
      }
      case "deployment.error":
        message = `❌ Deploy failed for *${name}*`;
        break;
      default:
        message = `ℹ️ Unknown event: ${type} for *${name}*`;
    }

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    });
  },

  async handleTestTeamBot(messageText: string) {
    if (!TEAM_TELEGRAM_BOT_TOKEN || !TEAM_TELEGRAM_CHAT_ID) {
      throw new Error("Team Telegram configuration missing");
    }

    const testMessage = `🧪 Test message from KornerTeamBot\n\n${messageText}`;

    await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TEAM_TELEGRAM_CHAT_ID,
      text: testMessage,
      parse_mode: "Markdown",
    });
  },

  async handleTeamBot(body: any) {
    const { message, callback_query } = body;

    // Handle brief callback queries (inline button presses)
    if (callback_query && callback_query.data?.startsWith("brief_")) {
      await briefService.handleCallbackQuery(callback_query);
      return;
    }

    if (!message || !message.text) {
      return;
    }

    if (!TEAM_TELEGRAM_BOT_TOKEN) {
      throw new Error("Team Telegram bot token missing");
    }

    const userText = message.text.trim();
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const userName = message.from?.first_name || message.from?.username || "Пользователь";
    const redisKey = `${MESSAGES_KEY_PREFIX}${chatId}`;

    // Handle /qamalladin command
    if (userText.startsWith("/qamalladin")) {
      await briefService.startBrief(userId, userName, chatId);
      return;
    }

    // Check if user has an active brief session
    const briefState = await briefService.getState(userId);
    if (briefState) {
      await briefService.handleTextAnswer(userId, chatId, userText);
      return;
    }

    // Сохраняем сообщение в Redis (всегда, кроме команд бота)
    if (!userText.startsWith("🤖") && !userText.startsWith("/")) {
      const messageData = JSON.stringify({
        username: userName,
        text: userText,
        timestamp: new Date().toISOString(),
        messageId: message.message_id,
      });

      try {
        const pushResult = await redis.lpush(redisKey, messageData);
        await redis.ltrim(redisKey, 0, MAX_STORED_MESSAGES - 1);
        console.log(`Message saved to Redis, list length: ${pushResult}`);
      } catch (redisError) {
        console.error("Redis save error:", redisError);
      }
    }

    // Проверяем команду summarize
    const summarizeMatch = userText.match(/@KornerTeamBot\s+summarize\s+(\d+)/i);
    if (summarizeMatch) {
      const count = Math.min(parseInt(summarizeMatch[1], 10), 100);

      const rawMessages = await redis.lrange(redisKey, 0, count - 1);
      const messages = rawMessages
        .map((m) => {
          try {
            return JSON.parse(m);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .reverse();

      if (messages.length === 0) {
        await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "📭 Нет сохранённых сообщений для суммаризации",
          reply_to_message_id: message.message_id,
        });
      } else {
        await axios.post(
          `https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendChatAction`,
          { chat_id: chatId, action: "typing" }
        );

        const summary = await summarizeMessages(messages);

        await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: `📋 *Резюме последних ${messages.length} сообщений:*\n\n${summary}`,
          parse_mode: "Markdown",
          reply_to_message_id: message.message_id,
        });
      }
      return;
    }

    // Проверяем, что бота тегнули (обычный AI ответ)
    if (
      userText.includes("@KornerTeamBot") ||
      (message.reply_to_message && message.reply_to_message.from?.is_bot)
    ) {
      let cleanPrompt = userText
        .replace("@KornerTeamBot", "")
        .replace(/^\s*\/\w+\s*/, "")
        .trim();

      if (!cleanPrompt) {
        cleanPrompt = "Привет!";
      }

      const contextPrompt = `Отвечай кратко (1-2 предложения) на русском. ${userName} спрашивает: ${cleanPrompt}`;
      const aiResponse = await askDeepSeek(contextPrompt);

      await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: `🤖 ${aiResponse}`,
        reply_to_message_id: message.message_id,
      });
    }
  },

  async getTeamBotMessages(chatId: string, limit: number) {
    const redisKey = `${MESSAGES_KEY_PREFIX}${chatId}`;

    const count = await redis.llen(redisKey);
    const rawMessages = await redis.lrange(redisKey, 0, limit - 1);
    const messages = rawMessages.map((m) => {
      try {
        return JSON.parse(m);
      } catch {
        return m;
      }
    });

    return { chatId, totalCount: count, returnedCount: messages.length, messages };
  },

  async sendDailyReminder() {
    await dailyReminderService.sendDailyReminder();
  },
};
