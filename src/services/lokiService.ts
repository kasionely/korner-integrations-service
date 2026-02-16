import axios from "axios";

interface LokiLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  service: string;
  environment: string;
  userId?: number;
  event?: string;
  [key: string]: any;
}

class LokiService {
  private lokiUrl: string;
  private serviceName: string;
  private environment: string;
  private isEnabled: boolean;

  constructor() {
    this.lokiUrl = process.env.LOKI_URL || "http://localhost:3100";
    this.serviceName = process.env.SERVICE_NAME || "korner-integrations-service";
    this.environment = process.env.ACTIVE_ENV || "development";
    this.isEnabled = process.env.ACTIVE_ENV === "prod" && !!process.env.LOKI_URL;
  }

  private formatTimestamp(): string {
    return (Date.now() * 1000000).toString();
  }

  private async sendToLoki(entry: LokiLogEntry): Promise<void> {
    if (!this.isEnabled) {
      console.log(`[LokiService] Not sending log (disabled): ${entry.message}`);
      return;
    }

    try {
      const labels = {
        service: entry.service,
        environment: entry.environment,
        level: entry.level,
        ...(entry.event && { event: entry.event }),
        ...(entry.userId && { userId: entry.userId.toString() }),
      };

      const payload = {
        streams: [
          {
            stream: labels,
            values: [[this.formatTimestamp(), JSON.stringify(entry)]],
          },
        ],
      };

      await axios.post(`${this.lokiUrl}/loki/api/v1/push`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      });

      console.log(`[LokiService] Successfully sent log to Loki: ${entry.event || entry.message}`);
    } catch (error) {
      console.error("[LokiService] Failed to send log to Loki:", error);
    }
  }

  async logBarPurchase(data: {
    userId: number;
    barId: string;
    paymentType: "wallet" | "token" | "card";
    amount: number;
    currency: string;
    transactionId?: number;
    paymentId?: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await this.sendToLoki({
      timestamp: new Date().toISOString(),
      level: data.success ? "info" : "error",
      message: `Bar purchase ${data.success ? "successful" : "failed"}`,
      service: this.serviceName,
      environment: this.environment,
      event: "bar_purchase",
      ...data,
    });
  }

  async logSubscriptionPurchase(data: {
    userId: number;
    planId: number;
    priceId: number;
    paymentType: "wallet" | "token" | "card";
    amount: number;
    currency: string;
    subscriptionId?: number;
    transactionId?: number;
    paymentId?: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await this.sendToLoki({
      timestamp: new Date().toISOString(),
      level: data.success ? "info" : "error",
      message: `Subscription purchase ${data.success ? "successful" : "failed"}`,
      service: this.serviceName,
      environment: this.environment,
      event: "subscription_purchase",
      ...data,
    });
  }

  async logSubscriptionCancellation(data: {
    userId: number;
    subscriptionId: number;
    planName: string;
    expiresAt: string;
    cancelledAt: string;
  }): Promise<void> {
    await this.sendToLoki({
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Subscription cancelled",
      service: this.serviceName,
      environment: this.environment,
      event: "subscription_cancellation",
      ...data,
    });
  }

  async logSubscriptionRenewal(data: {
    userId: number;
    subscriptionId: number;
    planName: string;
    amount: number;
    currency: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await this.sendToLoki({
      timestamp: new Date().toISOString(),
      level: data.success ? "info" : "error",
      message: `Subscription renewal ${data.success ? "successful" : "failed"}`,
      service: this.serviceName,
      environment: this.environment,
      event: "subscription_renewal",
      ...data,
    });
  }

  async logWalletOperation(data: {
    userId: number;
    operation: "deposit" | "withdraw";
    amount: number;
    currency: string;
    transactionId: number;
    source: string;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await this.sendToLoki({
      timestamp: new Date().toISOString(),
      level: data.success ? "info" : "error",
      message: `Wallet ${data.operation} ${data.success ? "successful" : "failed"}`,
      service: this.serviceName,
      environment: this.environment,
      event: "wallet_operation",
      ...data,
    });
  }

  async logPaymentError(data: {
    userId: number;
    paymentType: "wallet" | "token" | "card";
    transactionId?: number;
    paymentId?: string;
    error: string;
    details?: any;
  }): Promise<void> {
    await this.sendToLoki({
      timestamp: new Date().toISOString(),
      level: "error",
      message: `Payment error: ${data.error}`,
      service: this.serviceName,
      environment: this.environment,
      event: "payment_error",
      ...data,
    });
  }

  async log(data: {
    level: "info" | "warn" | "error" | "debug";
    message: string;
    event?: string;
    userId?: number;
    [key: string]: any;
  }): Promise<void> {
    await this.sendToLoki({
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      environment: this.environment,
      ...data,
    });
  }
}

export const lokiService = new LokiService();
export default lokiService;