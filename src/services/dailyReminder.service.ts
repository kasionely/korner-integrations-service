import axios from "axios";

const TEAM_TELEGRAM_BOT_TOKEN = process.env.TEAM_TELEGRAM_BOT_TOKEN;
const TEAM_TELEGRAM_CHAT_ID = process.env.TEAM_TELEGRAM_CHAT_ID;

export class DailyReminderService {
  private intervalId: NodeJS.Timeout | null = null;

  async getChatMembers(): Promise<string[]> {
    const teamMembers: string[] = [
      "@iamkj",
      "@ne_comics",
      "@zerxshi",
      "@dagarkow",
      "@dirrok",
      "@kikifonbikki",
      "@weilrfr",
      "@Evazibolova",
      "@RedeRedeRedeRedeRedeRede",
      "@alishmoiseev",
      "@itanatar",
    ];

    return teamMembers;
  }

  async sendDailyReminder(): Promise<void> {
    try {
      const members = await this.getChatMembers();

      let message = "🌆 Добрый вечер, команда!\n\n⏰ Время для дэйли стендапа!\n\n";

      if (members.length > 0) {
        message += `Участники: ${members.join(", ")}\n\n`;
      } else {
        message += "👥 Призываем всех участников чата!\n\n";
      }

      message +=
        "📝 Напоминаем поделиться:\n" +
        "• Что сделали вчера\n" +
        "• Что планируете сегодня\n" +
        "• Есть ли блокеры\n\n" +
        "💻 Google Meet: meet.google.com/rxj-ynqs-rqk\n\n" +
        "🚀 Удачного вечера!";

      await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TEAM_TELEGRAM_CHAT_ID,
        text: message,
      });

      console.log("Daily reminder sent successfully");
    } catch (error) {
      console.error("Error sending daily reminder:", error);
    }
  }

  private calculateTimeUntilNext19(): number {
    const now = new Date();
    const almaty = new Date(now.getTime() + 5 * 60 * 60 * 1000); // GMT+5

    const target = new Date(almaty);
    target.setHours(18, 55, 0, 0);

    if (almaty.getTime() > target.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime() - 5 * 60 * 60 * 1000 - now.getTime();
  }

  start(): void {
    console.log("Starting daily reminder service...");

    const scheduleNext = () => {
      const timeUntilNext = this.calculateTimeUntilNext19();

      this.intervalId = setTimeout(() => {
        this.sendDailyReminder();

        this.intervalId = setInterval(
          () => {
            this.sendDailyReminder();
          },
          24 * 60 * 60 * 1000
        );
      }, timeUntilNext);

      const nextTime = new Date(Date.now() + timeUntilNext + 5 * 60 * 60 * 1000);
      console.log(`Next daily reminder scheduled for: ${nextTime.toLocaleString()} (GMT+5)`);
    };

    scheduleNext();
  }

  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Daily reminder service stopped");
    }
  }
}

export const dailyReminderService = new DailyReminderService();