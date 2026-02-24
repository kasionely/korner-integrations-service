import OpenAI from "openai";

// AI модели через NeuroRouters
const DS_API_KEY = process.env.DS_API_KEY;

const client = new OpenAI({
  baseURL: "https://neurorouters.com/api/v1",
  apiKey: DS_API_KEY,
});

// Функция запроса к AI моделям с fallback
export async function askDeepSeek(prompt: string): Promise<string> {
  const modelsToTry = [
    "openai/gpt-4o-mini", // Попробуем сначала модель без reasoning
    "openai/gpt-4", // Fallback на обычную GPT-4
    "anthropic/claude-3-haiku", // Fallback на Claude
    "openai/gpt-3.5-turbo", // Последний fallback
  ];

  for (const model of modelsToTry) {
    try {
      return await askWithModel(prompt, model);
    } catch (error) {
      console.log(`Model ${model} failed, trying next...`, error);
      continue;
    }
  }

  return "Извините, все модели недоступны в данный момент.";
}

// Вспомогательная функция для запроса к конкретной модели
async function askWithModel(prompt: string, model: string): Promise<string> {
  try {
    if (!DS_API_KEY) {
      console.error("NeuroRouters API key not configured");
      throw new Error("NeuroRouters API key not configured");
    }

    console.log("NeuroRouters request:", {
      model,
      prompt: prompt.substring(0, 100) + "...",
      hasApiKey: !!DS_API_KEY,
      apiKeyPrefix: DS_API_KEY ? DS_API_KEY.substring(0, 10) + "..." : "none",
    });

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.5,
    });

    console.log("NeuroRouters response:", {
      model,
      data: JSON.stringify(completion, null, 2),
    });

    const message = completion.choices[0]?.message;

    console.log("Message structure debug:", {
      hasMessage: !!message,
      content: message?.content,
      reasoning: (message as any)?.reasoning,
      reasoning_details: (message as any)?.reasoning_details,
      messageKeys: message ? Object.keys(message) : [],
      fullMessage: JSON.stringify(message, null, 2),
    });

    // Для gpt-5-nano проверяем reasoning_details если content пустой
    let content = message?.content;

    // Если есть reasoning, добавим его к выводу для дебаггинга
    if ((message as any)?.reasoning) {
      console.log("Found reasoning field:", (message as any).reasoning);
    }

    if (
      !content &&
      (message as any)?.reasoning_details &&
      (message as any).reasoning_details.length > 0
    ) {
      console.log("Found reasoning_details:", (message as any).reasoning_details);

      // Попробуем извлечь что-то полезное из reasoning_details
      const reasoningDetail = (message as any).reasoning_details[0];
      if (reasoningDetail && reasoningDetail.type === "reasoning.encrypted") {
        // Это зашифрованные данные, попробуем что-то сделать
        console.log("Reasoning is encrypted, cannot decode client-side");
        content =
          "Модель сгенерировала ответ с внутренними рассуждениями, но ответ зашифрован. Попробуйте использовать другую модель.";
      } else {
        content = "Ответ сгенерирован с использованием внутренних рассуждений модели";
      }
    }

    if (!content) {
      console.log("No content, trying reasoning field:", (message as any)?.reasoning);
      content = (message as any)?.reasoning || "Извините, не удалось получить ответ.";
    }

    console.log("Final content being returned:", {
      content,
      contentLength: content?.length,
      contentSource: message?.content
        ? "message.content"
        : (message as any)?.reasoning
          ? "message.reasoning"
          : "fallback message",
    });

    return `${content}\n\n Ответ от модели: ${model}`;
  } catch (error: any) {
    console.error("NeuroRouters API error details:", {
      message: error.message,
      status: error.status,
      error: error.error,
    });
    return "Извините, произошла ошибка при обработке запроса.";
  }
}

// Функция для суммаризации сообщений чата
export async function summarizeMessages(
  messages: Array<{ username: string; text: string; timestamp: string }>
): Promise<string> {
  if (!DS_API_KEY) {
    return "API ключ не настроен";
  }

  if (messages.length === 0) {
    return "Нет сообщений для суммаризации";
  }

  // Форматируем сообщения для AI
  const formattedMessages = messages
    .map((m) => `[${m.timestamp}] ${m.username}: ${m.text}`)
    .join("\n");

  const prompt = `Сделай краткое резюме следующей переписки на русском языке. Выдели ключевые темы, решения и важные моменты. Формат: маркированный список.

Переписка:
${formattedMessages}

Резюме:`;

  try {
    const completion = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content;
    return content || "Не удалось создать резюме";
  } catch (error: any) {
    console.error("Summarize error:", error.message);
    return "Ошибка при создании резюме";
  }
}
