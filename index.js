require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const User = require("./models/User");

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
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.chat.first_name;

  // State-ni tozalash
  userState[chatId] = { score: 0, currentQuestion: 0 };

  bot.sendMessage(
    chatId,
    `Assalomu aleykum ${firstName} 😊\nEssential English Words botiga xush kelibsiz!`,
    getMainMenu()
  );

  User.updateOne(
    { telegram_id: chatId },
    {
      $setOnInsert: {
        telegram_id: chatId,
        first_name: firstName,
        started_at: new Date(),
      },
    },
    { upsert: true }
  ).catch((err) => console.error("User save error:", err));
});

// Test render qilish funksiyasi
async function renderTest(chatId, messageId) {
  const state = userState[chatId];
  if (!state || !state.book || !state.unit) return;

  const questions = TestsBank[state.book]?.units[state.unit];

  if (!questions || questions.length === 0) {
    return bot.editMessageText("⚠️ Bu unit uchun testlar hali qo'shilmagan.", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[{ text: "⬅️ Orqaga", callback_data: state.book }]],
      },
    });
  }

  // Test yakunlanganda
  if (state.currentQuestion >= questions.length) {
    const correct = state.score;
    const total = questions.length;
    const percent = Math.round((correct / total) * 100);
    let medal = percent >= 90 ? "🥇" : percent >= 70 ? "🥈" : "🥉";

    return bot.editMessageText(
      `🏁 **Test yakunlandi!**\n\n📚 Kitob: ${
        TestsBank[state.book].title
      }\n✅ To'g'ri: ${correct} ta\n❌ Xato: ${
        total - correct
      } ta\n📊 Natija: ${percent}%\n\n${medal} ${
        percent >= 70 ? "Barakalla!" : "Yana biroz o'qing."
      }`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Qayta ishlash", callback_data: state.unit }],
            [{ text: "🏠 Asosiy menyu", callback_data: "main_menu" }],
          ],
        },
      }
    );
  }

  const currentQ = questions[state.currentQuestion];
  const progress = `📊 Savol: ${state.currentQuestion + 1}/${
    questions.length
  } | ✅ Ball: ${state.score}`;

  const keyboard = [];
  for (let i = 0; i < currentQ.options.length; i += 2) {
    const row = [
      { text: currentQ.options[i], callback_data: `ans_${i}` },
      { text: currentQ.options[i + 1] || "", callback_data: `ans_${i + 1}` },
    ].filter((btn) => btn.text !== "");
    keyboard.push(row);
  }
  keyboard.push([{ text: "❌ Testni to'xtatish", callback_data: "test" }]);

  bot.editMessageText(`❓ **Savol:** ${currentQ.question}\n\n${progress}`, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

// Callback Query handling
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  // Xavfsizlik uchun state mavjudligini tekshirish
  if (!userState[chatId]) userState[chatId] = { score: 0, currentQuestion: 0 };
  const state = userState[chatId];

  try {
    // 1. Asosiy menyu
    if (data === "main_menu") {
      state.currentQuestion = 0;
      state.score = 0;
      return bot.editMessageText("🏠 Bo'limni tanlang:", {
        chat_id: chatId,
        message_id: messageId,
        ...getMainMenu(),
      });
    }

    // 2. Test yoki So'z tanlash
    if (data === "test" || data === "words") {
      state.mode = data;
      const list = data === "test" ? TestBooks : Books;
      return bot.editMessageText(
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

    // 3. Kitob Tanlash (Unitlar 1-sahifasini chiqaradi)
    if (data.match(/^(word|book)\d+$/)) {
      state.book = data;
      const backBtn = state.mode === "test" ? "test" : "words";
      return bot.editMessageText("📍 Unitni tanlang:", {
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

    // 4. Unit tanlash
    if (data.startsWith("unit_")) {
      state.unit = data;
      if (state.mode === "test") {
        state.currentQuestion = 0;
        state.score = 0;
        await renderTest(chatId, messageId);
      } else {
        const currentBook = WordsBank1[state.book];
        if (!currentBook?.units[data]) {
          return bot.answerCallbackQuery(query.id, {
            text: "⚠️ So'zlar topilmadi!",
            show_alert: true,
          });
        }

        const text = currentBook.units[data]
          .map((w, i) => `${i + 1}. ${w.en} - ${w.uz}`)
          .join("\n");

        bot.editMessageText(
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

    // 5. Javoblarni tekshirish
    if (data.startsWith("ans_")) {
      const currentBookTests = TestsBank[state.book];
      const unitTests = currentBookTests?.units[state.unit];
      if (!unitTests)
        return bot.answerCallbackQuery(query.id, { text: "Xatolik!" });

      const ansIdx = parseInt(data.split("_")[1]);
      const currentQ = unitTests[state.currentQuestion];

      if (ansIdx === currentQ.correctIndex) {
        state.score++;
        bot.answerCallbackQuery(query.id, { text: "✅ To'g'ri!" });
      } else {
        bot.answerCallbackQuery(query.id, {
          text: `❌ Xato! Javob: ${currentQ.options[currentQ.correctIndex]}`,
          show_alert: true,
        });
      }

      state.currentQuestion++;
      // Bir oz kutish foydalanuvchiga javobni ko'rish imkonini beradi
      setTimeout(() => renderTest(chatId, messageId), 500);
    }

    // 6. Sahifalash (Pagination)
    if (data.startsWith("page_")) {
      const backBtn = state.mode === "test" ? "test" : "words";
      bot.editMessageReplyMarkup(
        {
          inline_keyboard: [
            ...unitsPages[data],
            [{ text: "⬅️ Orqaga", callback_data: backBtn }],
          ],
        },
        { chat_id: chatId, message_id: messageId }
      );
    }

    // 7. Statistika
    if (data === "stat") {
      const count = await User.countDocuments();
      bot.editMessageText(
        `📊 **Bot statistikasi**\n\n👤 Jami foydalanuvchilar: ${count} ta`,
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

    // 8. Qo'llanma (Description)
    if (data === "description") {
      bot.editMessageText(
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

    bot.answerCallbackQuery(query.id).catch(() => {});
  } catch (err) {
    console.error("Callback Error:", err);
    bot.answerCallbackQuery(query.id, { text: "⚠️ Xatolik yuz berdi!" });
  }
});
