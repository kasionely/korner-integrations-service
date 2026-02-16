import { Resend } from "resend";

import {
  emailTemplateService,
  OtpTemplateData,
  PasswordResetTemplateData,
  ActionConfirmationTemplateData,
} from "./emailTemplates";

export class ResendService {
  private client: Resend;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set in environment variables");
    }

    this.client = new Resend(apiKey);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "korner@korner.pro";
    this.fromName = process.env.RESEND_FROM_NAME || "Your Korner App";
  }

  async sendEmail(
    toEmail: string,
    toName: string,
    subject: string,
    html: string,
    text: string
  ): Promise<void> {
    const { data, error } = await this.client.emails.send({
      from: `${this.fromName} <${this.fromEmail}>`,
      to: [`${toName} <${toEmail}>`],
      subject: subject,
      html: html,
      text: text,
    });

    if (error) {
      console.error("Error sending email via Resend:", error);
      throw new Error("Failed to send email");
    }

    console.log("Email sent successfully via Resend:", data);
  }

  async sendOtpEmail(
    toEmail: string,
    toName: string,
    otpCode: string,
    language: "en" | "ru" = "en"
  ): Promise<void> {
    const subject =
      language === "ru" ? "Korner - Код подтверждения" : "Korner App - OTP Verification Code";

    const templateData: OtpTemplateData = {
      userName: toName,
      otpCode: otpCode,
      language: language,
    };

    const { html, text } = emailTemplateService.renderOtpVerification(templateData);
    await this.sendEmail(toEmail, toName, subject, html, text);
  }

  async sendPasswordResetEmail(
    toEmail: string,
    toName: string,
    resetCode: string,
    language: "en" | "ru" = "en"
  ): Promise<void> {
    const subject =
      language === "ru" ? "Korner - Сброс пароля" : "Korner App - Password Reset Request";

    const templateData: PasswordResetTemplateData = {
      userName: toName,
      resetCode: resetCode,
      language: language,
    };

    const { html, text } = emailTemplateService.renderPasswordReset(templateData);
    await this.sendEmail(toEmail, toName, subject, html, text);
  }

  async sendActionConfirmationEmail(
    toEmail: string,
    toName: string,
    confirmationCode: string,
    actionTitle: string,
    actionDescription: string,
    actionType: string,
    expirationMinutes: string = "10",
    nextSteps: string = "the action will be completed and you will receive a confirmation.",
    language: "en" | "ru" = "en"
  ): Promise<void> {
    const subject =
      language === "ru"
        ? `Korner - Подтвердите действие: ${actionTitle}`
        : `Korner App - Confirm Your Action: ${actionTitle}`;

    const templateData: ActionConfirmationTemplateData = {
      userName: toName,
      actionTitle: actionTitle,
      actionDescription: actionDescription,
      confirmationCode: confirmationCode,
      actionType: actionType,
      requestTime: new Date().toLocaleString(),
      expirationMinutes: expirationMinutes,
      nextSteps: nextSteps,
      language: language,
    };

    const { html, text } = emailTemplateService.renderActionConfirmation(templateData);
    await this.sendEmail(toEmail, toName, subject, html, text);
  }
}

export const resendService = new ResendService();
