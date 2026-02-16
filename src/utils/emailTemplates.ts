import * as fs from "fs";
import * as path from "path";

export interface OtpTemplateData {
  userName: string;
  otpCode: string;
  language?: "en" | "ru";
  title?: string;
  message?: string;
}

export interface PasswordResetTemplateData {
  userName: string;
  resetCode: string;
  language?: "en" | "ru";
}

export interface ActionConfirmationTemplateData {
  userName: string;
  actionTitle: string;
  actionDescription: string;
  confirmationCode: string;
  actionType: string;
  requestTime: string;
  expirationMinutes: string;
  nextSteps: string;
  language?: "en" | "ru";
}

export class EmailTemplateService {
  private templatesPath: string;

  constructor() {
    this.templatesPath = path.join(process.cwd(), "mail");
  }

  private loadTemplate(templateName: string, language: string = "en"): string {
    const localizedTemplatePath = path.join(this.templatesPath, `${templateName}-${language}.html`);

    if (fs.existsSync(localizedTemplatePath)) {
      return fs.readFileSync(localizedTemplatePath, "utf-8");
    }

    if (language !== "en") {
      const fallbackTemplatePath = path.join(this.templatesPath, `${templateName}-en.html`);
      if (fs.existsSync(fallbackTemplatePath)) {
        return fs.readFileSync(fallbackTemplatePath, "utf-8");
      }
    }

    throw new Error(`Email template not found: ${templateName}-${language}.html`);
  }

  private replaceVariables(template: string, data: Record<string, string>): string {
    let result = template;

    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, "g");
      result = result.replace(regex, value);
    }

    return result;
  }

  renderOtpVerification(data: OtpTemplateData): { html: string; text: string } {
    const language = data.language || "en";
    const template = this.loadTemplate("otp", language);

    const defaultTitle =
      language === "ru" ? "Активируйте свой аккаунт Korner." : "Activate your Korner. account";

    const defaultMessage =
      language === "ru"
        ? "Здравствуйте!<br>Спасибо, что зарегистрировались в Korner.<br>Вот код, который понадобится для продолжения. Просто введите его в поле на предыдущем экране — и вы сможете начать создавать свою первую страницу!"
        : "Hello!<br>Thank you for signing up for Korner.<br>Here's the code you'll need to continue. Simply enter it in the field on the previous screen — and you'll be able to start creating your first page!";

    const html = this.replaceVariables(template, {
      userName: data.userName,
      OTP_CODE: data.otpCode,
      TITLE: data.title || defaultTitle,
      MESSAGE: data.message || defaultMessage,
    });

    const title = data.title || defaultTitle;
    const message = (data.message || defaultMessage).replace(/<br>/g, "\n").replace(/<[^>]*>/g, "");

    const text = `
${title}

${message}

Ваш код: ${data.otpCode}

Этот код истекает через 10 минут в целях безопасности.

Нужна помощь? Свяжитесь с нами: support@korner.pro

© 2025 Korner. Все права защищены.
    `.trim();

    return { html, text };
  }

  renderPasswordReset(data: PasswordResetTemplateData): { html: string; text: string } {
    const language = data.language || "en";

    const title = language === "ru" ? "Сброс пароля Korner." : "Reset your Korner. password";

    const message =
      language === "ru"
        ? "Здравствуйте!<br>Вы запросили сброс пароля для вашего аккаунта Korner.<br>Вот ваш код подтверждения. Просто введите его в поле на экране сброса пароля, чтобы создать новый пароль."
        : "Hello!<br>You requested to reset your password for your Korner account.<br>Here's your verification code. Simply enter it in the field on the password reset screen to create a new password.";

    const otpData: OtpTemplateData = {
      userName: data.userName,
      otpCode: data.resetCode,
      language: language,
      title: title,
      message: message,
    };

    return this.renderOtpVerification(otpData);
  }

  renderActionConfirmation(data: ActionConfirmationTemplateData): { html: string; text: string } {
    const language = data.language || "en";
    const template = this.loadTemplate("action-confirmation", language);
    const html = this.replaceVariables(template, {
      userName: data.userName,
      actionTitle: data.actionTitle,
      actionDescription: data.actionDescription,
      confirmationCode: data.confirmationCode,
      actionType: data.actionType,
      requestTime: data.requestTime,
      expirationMinutes: data.expirationMinutes,
      nextSteps: data.nextSteps,
    });

    const text =
      language === "ru"
        ? `
Здравствуйте, ${data.userName}!

Требуется подтверждение действия

${data.actionTitle}
${data.actionDescription}

Ваш код подтверждения: ${data.confirmationCode}

Детали действия:
- Тип: ${data.actionType}
- Запрошено: ${data.requestTime}

Этот код истекает через ${data.expirationMinutes} минут в целях безопасности.

Что происходит дальше: ${data.nextSteps}

Если вы не запрашивали это действие, немедленно свяжитесь с нашей службой поддержки.

Нужна помощь? Свяжитесь с нами: support@korner.pro

© 2025 Korner. Все права защищены.
    `.trim()
        : `
Hello ${data.userName}!

Action Confirmation Required

${data.actionTitle}
${data.actionDescription}

Your confirmation code is: ${data.confirmationCode}

Action Details:
- Type: ${data.actionType}
- Requested: ${data.requestTime}

This code expires in ${data.expirationMinutes} minutes for your security.

What happens next: ${data.nextSteps}

If you didn't request this action, please contact our support team immediately.

Need help? Contact us at support@korner.pro

© 2025 Korner. All rights reserved.
    `.trim();

    return { html, text };
  }
}

export const emailTemplateService = new EmailTemplateService();
