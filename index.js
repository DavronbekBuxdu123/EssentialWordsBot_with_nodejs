require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const User = require("./models/User");
const ADMIN_ID = process.env.ADMIN_ID;
// Ma'lumotlarni import qilish
const WordsBank1 = require("./data/words/wordsBank");
const Books = require("./data/words/books");
const TestBooks = require("./data/tests/TestBooks");
const {
  unitsPage1,
  unitsPage2,
  unitsPage3,
  unitsPage4,
  unitsPage5,
  unitsPage6,
} = require("./data/words/units");
const TestsBank = require("./data/tests/TestWords");

const unitsPages = {
  page_1: unitsPage1,
  page_2: unitsPage2,
  page_3: unitsPage3,
  page_4: unitsPage4,
  page_5: unitsPage5,
  page_6: unitsPage6,
};

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const userState = {};

mongoose
  .connect(process.env.MONGO_DB_URL)
  .then(() => console.log("✅ MongoDB ulandi"))
  .catch((err) => console.error("❌ MongoDB xatosi:", err));

// Asosiy menyu funksiyasi
const getMainMenu = () => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: "Test ishlash ⚡️", callback_data: "test" }],
      [{ text: "So'zlarni yodlash 📜", callback_data: "words" }],
      [
        { text: "Statistika 📊", callback_data: "stat" },
        { text: "Qo'llanma 📄", callback_data: "description" },
      ],
    ],
  },
});

// Start komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.chat.first_name;

  userState[chatId] = { score: 0, currentQuestion: 0 };
  bot.sendMessage(ADMIN_ID, `${chatId} user ${firstName} start bosdi`);
  await bot.sendMessage(
    chatId,
    `Assalomu aleykum ${firstName} 😊\nEssential English Words botiga xush kelibsiz!`,
    getMainMenu()
  );

  User.updateOne(
    { telegram_id: chatId },
    {
      $set: { first_name: firstName },
      $setOnInsert: { telegram_id: chatId, started_at: new Date() },
    },
    { upsert: true }
  ).catch((err) => console.error("User save error:", err));
});

// Test render qilish funksiyasi
async function renderTest(chatId, messageId) {
  try {
    const state = userState[chatId];
    if (!state || !state.book || !state.unit) return;

    const questions = TestsBank[state.book]?.units[state.unit];

    if (!questions || questions.length === 0) {
      return await bot.editMessageText("⚠️ Testlar topilmadi.", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [[{ text: "⬅️ Orqaga", callback_data: state.book }]],
        },
      });
    }

    if (state.currentQuestion >= questions.length) {
      const correct = state.score;
      const total = questions.length;
      const percent = Math.round((correct / total) * 100);
      let medal = percent >= 90 ? "🥇" : percent >= 70 ? "🥈" : "🥉";

      return await bot.editMessageText(
        `🏁 **Test yakunlandi!**\n\n✅ To'g'ri: ${correct}\n❌ Xato: ${
          total - correct
        }\n📊 Natija: ${percent}%`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Qayta ishlash", callback_data: state.unit }],
              [{ text: "🏠 Menyu", callback_data: "main_menu" }],
            ],
          },
        }
      );
    }

    const currentQ = questions[state.currentQuestion];
    const keyboard = [];
    for (let i = 0; i < currentQ.options.length; i += 2) {
      const row = [
        { text: currentQ.options[i], callback_data: `ans_${i}` },
        { text: currentQ.options[i + 1] || "", callback_data: `ans_${i + 1}` },
      ].filter((b) => b.text !== "");
      keyboard.push(row);
    }
    keyboard.push([{ text: "❌ To'xtatish", callback_data: "test" }]);

    await bot.editMessageText(
      `❓ **Savol:** ${currentQ.question}\n\n📊 Savol: ${
        state.currentQuestion + 1
      }/${questions.length} ✅ Ball: ${state.score}`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      }
    );
  } catch (err) {
    if (!err.message.includes("message is not modified")) {
      console.error("RenderTest Error:", err.message);
    }
  }
}

// Callback Query handling
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  if (!userState[chatId]) userState[chatId] = { score: 0, currentQuestion: 0 };
  const state = userState[chatId];

  try {
    // 1. Javoblarni tekshirish (Alert barqarorligi uchun tepaga chiqdi)
    if (data.startsWith("ans_")) {
      const currentBookTests = TestsBank[state.book];
      const unitTests = currentBookTests?.units[state.unit];
      if (!unitTests)
        return await bot.answerCallbackQuery(query.id, { text: "Xatolik!" });

      const ansIdx = parseInt(data.split("_")[1]);
      const currentQ = unitTests[state.currentQuestion];

      if (ansIdx === currentQ.correctIndex) {
        state.score++;
        await bot.answerCallbackQuery(query.id, { text: "✅ To'g'ri!" });
      } else {
        await bot.answerCallbackQuery(query.id, {
          text: `❌ Xato! Javob: ${currentQ.options[currentQ.correctIndex]}`,
          show_alert: true,
        });
      }

      state.currentQuestion++;
      // RenderTest await bilan chaqiriladi, setTimeout olib tashlandi
      return await renderTest(chatId, messageId);
    }

    // 2. Qolgan barcha tugmalar uchun standart javob
    await bot.answerCallbackQuery(query.id).catch(() => {});

    if (data === "main_menu") {
      state.currentQuestion = 0;
      state.score = 0;
      return await bot.editMessageText("🏠 Bo'limni tanlang:", {
        chat_id: chatId,
        message_id: messageId,
        ...getMainMenu(),
      });
    }

    if (data === "test" || data === "words") {
      state.mode = data;
      const list = data === "test" ? TestBooks : Books;
      return await bot.editMessageText(
        `📚 ${data === "test" ? "Test" : "So'zlar"} uchun kitobni tanlang:`,
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              ...list,
              [{ text: "⬅️ Orqaga", callback_data: "main_menu" }],
            ],
          },
        }
      );
    }

    if (data.match(/^(word|book)\d+$/)) {
      state.book = data;
      const backBtn = state.mode === "test" ? "test" : "words";
      return await bot.editMessageText("📍 Unitni tanlang:", {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            ...unitsPage1,
            [{ text: "⬅️ Orqaga", callback_data: backBtn }],
          ],
        },
      });
    }

    if (data.startsWith("unit_")) {
      state.unit = data;
      if (state.mode === "test") {
        state.currentQuestion = 0;
        state.score = 0;
        return await renderTest(chatId, messageId);
      } else {
        const currentBook = WordsBank1[state.book];
        if (!currentBook?.units[data]) {
          return await bot.sendMessage(chatId, "⚠️ So'zlar topilmadi!");
        }

        const text = currentBook.units[data]
          .map((w, i) => `${i + 1}. ${w.en} - ${w.uz}`)
          .join("\n");

        return await bot.editMessageText(
          `📖 *${currentBook.title}*\n📍 Unit ${data.split("_")[1]}\n\n${text}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "⬅️ Orqaga", callback_data: state.book }],
              ],
            },
          }
        );
      }
    }

    if (data.startsWith("page_")) {
      const backBtn = state.mode === "test" ? "test" : "words";
      return await bot.editMessageReplyMarkup(
        {
          inline_keyboard: [
            ...unitsPages[data],
            [{ text: "⬅️ Orqaga", callback_data: backBtn }],
          ],
        },
        { chat_id: chatId, message_id: messageId }
      );
    }

    if (data === "stat") {
      const count = await User.countDocuments();
      return await bot.editMessageText(
        `📊 **Bot statistikasi**\n\n👤 Jami foydalanuvchilar: ${
          100 + count
        } ta`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Orqaga", callback_data: "main_menu" }],
            ],
          },
        }
      );
    }

    if (data === "description") {
      return await bot.editMessageText(
        "Hurmatli foydalanuvchi! 😊\n\nUshbu bot orqali *Essential English Words* kitobidagi so'zlarni o'rganishingiz va test orqali bilimingizni tekshirishingiz mumkin.\n\n👨‍💻 Admin: @Aslonov_Davronbek",
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Orqaga", callback_data: "main_menu" }],
            ],
          },
        }
      );
    }
  } catch (err) {
    if (!err.message.includes("message is not modified")) {
      console.error("Callback General Error:", err);
    }
  }
});
