import axios from "axios";
import redis from "../utils/redis";

const TEAM_TELEGRAM_BOT_TOKEN = process.env.TEAM_TELEGRAM_BOT_TOKEN;
const BRIEF_TELEGRAM_CHAT_ID = process.env.BRIEF_TELEGRAM_CHAT_ID;

const BRIEF_STATE_PREFIX = "brief_state:";
const BRIEF_TTL = 60 * 60 * 24; // 24 hours

interface BriefQuestion {
  id: number;
  text: string;
  type: "text" | "checkbox" | "radio";
  options?: string[];
  hasOther?: boolean;
  hint?: string;
}

interface BriefState {
  step: number;
  answers: string[];
  selectedOptions: string[];
  waitingForOther: boolean;
  userName: string;
  chatId: number;
}

const QUESTIONS: BriefQuestion[] = [
  {
    id: 1,
    text: "Ваше имя / никнейм",
    type: "text",
  },
  {
    id: 2,
    text: "E-mail | Telegram | WhatsApp",
    type: "text",
  },
  {
    id: 3,
    text: "Вы кто?",
    type: "text",
    hint: "Инфлюенсер, стример, блоггер, МСБ, Ивент агентство и тд",
  },
  {
    id: 4,
    text: "Текст о себе, либо о проекте",
    type: "text",
    hint: "Расскажите тезисно о том, чем вы занимаетесь",
  },
  {
    id: 5,
    text: "Ссылки на платформы",
    type: "text",
    hint: "Instagram, TikTok, YouTube, Twitch и тд",
  },
  {
    id: 6,
    text: "Кто ваша аудитория?",
    type: "text",
    hint: "Опишите их: возраст, пол и увлечения",
  },
  {
    id: 7,
    text: "География вашей аудитории",
    type: "checkbox",
    options: ["Казахстан", "СНГ (в тч Казахстан)", "Весь мир"],
  },
  {
    id: 8,
    text: "Что должно быть на странице?",
    type: "checkbox",
    options: [
      "Аватар/логотип",
      "Короткое описание",
      "Социальные иконки",
      "Донаты",
      "Товары",
      "Видео/рилсы",
      "Форма обратной связи",
      "Кнопки мессенджеров",
    ],
    hasOther: true,
  },
  {
    id: 9,
    text: "Есть ли у вас фирменные цвета?",
    type: "text",
    hint: "Если есть, напишите их, либо код RGB, HEX, CMYK",
  },
  {
    id: 10,
    text: "Какой стиль вам ближе?",
    type: "checkbox",
    options: [
      "Минимализм",
      "Ярко / Креативно",
      "Премиум",
      "Трендовый стиль",
      "Корпоративный стиль",
      "На усмотрение команды Korner",
    ],
  },
  {
    id: 11,
    text: "На каком языке должна быть страница?",
    type: "checkbox",
    options: ["Казахский", "Русский", "Английский"],
  },
  {
    id: 12,
    text: "Что должна передавать ваша страница?",
    type: "checkbox",
    options: [
      "Мысли / цитаты / фразы",
      "Польза для аудитории",
      "Призыв к действию",
      "Факты и достижения",
      "Инфо о вас",
    ],
    hasOther: true,
  },
  {
    id: 13,
    text: "Есть ли продукт, который подписчики готовы купить?",
    type: "radio",
    options: ["Да, есть", "Нету", "В процессе запуска"],
  },
];

async function getState(userId: number): Promise<BriefState | null> {
  const raw = await redis.get(`${BRIEF_STATE_PREFIX}${userId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function saveState(userId: number, state: BriefState): Promise<void> {
  await redis.set(`${BRIEF_STATE_PREFIX}${userId}`, JSON.stringify(state), "EX", BRIEF_TTL);
}

async function clearState(userId: number): Promise<void> {
  await redis.del(`${BRIEF_STATE_PREFIX}${userId}`);
}

function buildCheckboxKeyboard(
  questionIndex: number,
  question: BriefQuestion,
  selectedOptions: string[]
) {
  const rows = (question.options || []).map((opt, i) => {
    const isSelected = selectedOptions.includes(opt);
    const marker = isSelected ? "✅" : "⬜";
    return [
      {
        text: `${marker} ${opt}`,
        callback_data: `brief_check_${questionIndex}_${i}`,
      },
    ];
  });

  if (question.hasOther) {
    const otherSelected = selectedOptions.includes("__other__");
    const otherMarker = otherSelected ? "✅" : "⬜";
    rows.push([
      {
        text: `${otherMarker} Другое`,
        callback_data: `brief_other_${questionIndex}`,
      },
    ]);
  }

  rows.push([
    {
      text: "✅ Готово",
      callback_data: `brief_done_${questionIndex}`,
    },
  ]);

  return { inline_keyboard: rows };
}

function buildRadioKeyboard(questionIndex: number, question: BriefQuestion) {
  const rows = (question.options || []).map((opt, i) => [
    {
      text: opt,
      callback_data: `brief_radio_${questionIndex}_${i}`,
    },
  ]);

  return { inline_keyboard: rows };
}

async function sendQuestion(chatId: number, questionIndex: number, state: BriefState) {
  const question = QUESTIONS[questionIndex];
  let text = `<b>Вопрос ${question.id} из ${QUESTIONS.length}</b>\n\n${question.text}`;

  if (question.hint) {
    text += `\n<i>${question.hint}</i>`;
  }

  if (question.type === "text") {
    await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    });
  } else if (question.type === "checkbox") {
    const keyboard = buildCheckboxKeyboard(questionIndex, question, state.selectedOptions);
    await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } else if (question.type === "radio") {
    const keyboard = buildRadioKeyboard(questionIndex, question);
    await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }
}

function formatBriefMessage(state: BriefState): string {
  let msg = `<b>📋 Новый бриф: Korner × Qamalladin Media</b>\n`;
  msg += `<b>От:</b> ${state.userName}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const answer = state.answers[i] || "—";
    msg += `<b>${q.id}. ${q.text}</b>\n${answer}\n\n`;
  }

  return msg;
}

async function sendCompletedBrief(state: BriefState): Promise<void> {
  if (!BRIEF_TELEGRAM_CHAT_ID) {
    console.error("BRIEF_TELEGRAM_CHAT_ID is not set");
    return;
  }

  const message = formatBriefMessage(state);

  await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: BRIEF_TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML",
  });
}

async function moveToNextQuestion(userId: number, state: BriefState): Promise<void> {
  state.step += 1;
  state.selectedOptions = [];
  state.waitingForOther = false;

  if (state.step >= QUESTIONS.length) {
    await clearState(userId);
    await sendCompletedBrief(state);
    await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: state.chatId,
      text: "Спасибо! Ваш бриф отправлен команде ✅\nМы свяжемся с вами в ближайшее время.",
    });
    return;
  }

  await saveState(userId, state);
  await sendQuestion(state.chatId, state.step, state);
}

export const briefService = {
  getState,

  async startBrief(userId: number, userName: string, chatId: number): Promise<void> {
    const state: BriefState = {
      step: 0,
      answers: [],
      selectedOptions: [],
      waitingForOther: false,
      userName,
      chatId,
    };

    await saveState(userId, state);

    await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text:
        "<b>Korner × Qamalladin Media</b>\n\n" +
        "Добро пожаловать! Заполните бриф, чтобы мы могли создать для вас идеальную страницу.\n\n" +
        "Всего 13 вопросов. Начнём!",
      parse_mode: "HTML",
    });

    await sendQuestion(chatId, 0, state);
  },

  async handleTextAnswer(userId: number, chatId: number, text: string): Promise<void> {
    const state = await getState(userId);
    if (!state) return;

    const question = QUESTIONS[state.step];

    if (state.waitingForOther) {
      state.selectedOptions.push(text);
      state.waitingForOther = false;

      const displayOptions = state.selectedOptions
        .filter((o) => o !== "__other__")
        .join(", ");
      state.answers[state.step] = displayOptions;

      await moveToNextQuestion(userId, state);
      return;
    }

    if (question.type === "text") {
      state.answers[state.step] = text;
      await moveToNextQuestion(userId, state);
    }
  },

  async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const data: string = callbackQuery.data;
    const userId: number = callbackQuery.from.id;
    const chatId: number = callbackQuery.message.chat.id;
    const messageId: number = callbackQuery.message.message_id;

    // Answer callback to remove spinner
    await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      callback_query_id: callbackQuery.id,
    });

    const state = await getState(userId);
    if (!state) return;

    if (data === "brief_cancel") {
      await clearState(userId);
      await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: "Заполнение брифа отменено.",
      });
      return;
    }

    if (data.startsWith("brief_radio_")) {
      const parts = data.split("_");
      const optionIndex = parseInt(parts[3], 10);
      const question = QUESTIONS[state.step];
      const selectedOption = question.options![optionIndex];

      state.answers[state.step] = selectedOption;
      await moveToNextQuestion(userId, state);
      return;
    }

    if (data.startsWith("brief_check_")) {
      const parts = data.split("_");
      const optionIndex = parseInt(parts[3], 10);
      const question = QUESTIONS[state.step];
      const option = question.options![optionIndex];

      const idx = state.selectedOptions.indexOf(option);
      if (idx >= 0) {
        state.selectedOptions.splice(idx, 1);
      } else {
        state.selectedOptions.push(option);
      }

      await saveState(userId, state);

      const keyboard = buildCheckboxKeyboard(state.step, question, state.selectedOptions);
      await axios.post(
        `https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`,
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard,
        }
      );
      return;
    }

    if (data.startsWith("brief_other_")) {
      const hasOther = state.selectedOptions.includes("__other__");
      if (hasOther) {
        state.selectedOptions = state.selectedOptions.filter((o) => o !== "__other__");
        await saveState(userId, state);

        const question = QUESTIONS[state.step];
        const keyboard = buildCheckboxKeyboard(state.step, question, state.selectedOptions);
        await axios.post(
          `https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`,
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          }
        );
      } else {
        state.selectedOptions.push("__other__");
        state.waitingForOther = true;
        await saveState(userId, state);

        await axios.post(`https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: "Напишите ваш вариант:",
        });
      }
      return;
    }

    if (data.startsWith("brief_done_")) {
      if (state.selectedOptions.length === 0) {
        await axios.post(
          `https://api.telegram.org/bot${TEAM_TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
          {
            callback_query_id: callbackQuery.id,
            text: "Выберите хотя бы один вариант",
            show_alert: true,
          }
        );
        return;
      }

      const displayOptions = state.selectedOptions
        .filter((o) => o !== "__other__")
        .join(", ");
      state.answers[state.step] = displayOptions;

      await moveToNextQuestion(userId, state);
    }
  },
};
