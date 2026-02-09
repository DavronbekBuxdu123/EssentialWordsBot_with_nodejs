require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const mongoose = require("mongoose");
const User = require("./models/User");

mongoose
  .connect(process.env.MONGO_DB_URL)
  .then(() => console.log(" MongoDB ulandi"))
  .catch((err) => console.error(" mongo db bn xato", err));

const TOKEN = process.env.BOT_TOKEN;

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

const ADMIN_ID = process.env.ADMIN_ID;
const bot = new TelegramBot(TOKEN, { polling: true });
const userState = {};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const first_name = msg.chat.first_name;
  User.updateOne(
    { telegram_id: chatId },
    {
      $setOnInsert: {
        telegram_id: chatId,
        username: msg.from.username || null,
        first_name,
        started_at: new Date(),
      },
    },
    { upsert: true }
  ).catch(console.error);
  bot.sendMessage(ADMIN_ID, `${chatId} user \n ${first_name} start bosdi`);
  bot.sendMessage(
    chatId,
    `Assalomu aleykum hurmatli ${first_name}😊,\nbotimizga xush kelibsiz! \nQuyidagi bo'limlardan birini tanlang :`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Test ishlash ⚡️", callback_data: "test" }],
          [{ text: "So'zlarni yodlash 📜", callback_data: "words" }],
          [{ text: "Qo'llanma 📄", callback_data: "description" }],
          [{ text: "Statistika 📊", callback_data: "stat" }],
        ],
      },
    }
  );
});

function startTest(chatId) {
  const state = userState[chatId];
  const book = state.book;
  const unit = state.unit;
  const questionIndex = state.currentQuestion;
  const questions = TestsBank[book].units[unit];
  if (questionIndex >= questions.length) {
    if (state.lastMessageId) {
      bot.deleteMessage(chatId, state.lastMessageId).catch(() => {});
    }
    bot.sendMessage(
      chatId,
      `📚 Kitob: ${TestsBank[book].title}\n🔹 Unit: ${unit}\n\n✅ Siz ${state.score} ta to'g'ri javob berdingiz!`
    );
    return;
  }
  const currentQ = questions[questionIndex];
  const keyboard = [
    [
      { text: currentQ.options[0], callback_data: `answer_0` },
      { text: currentQ.options[1], callback_data: `answer_1` },
    ],
    [
      { text: currentQ.options[2], callback_data: `answer_2` },
      { text: currentQ.options[3], callback_data: `answer_3` },
    ],
  ];

  if (state.lastMessageId) {
    bot.deleteMessage(chatId, state.lastMessageId).catch(() => {});
  }

  bot
    .sendMessage(
      chatId,
      `${questionIndex + 1}. ${currentQ.question}\n🔹Natija: ${state.score}`,
      {
        reply_markup: { inline_keyboard: keyboard },
      }
    )
    .then((msg) => {
      state.lastMessageId = msg.message_id;
    });
}

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const queryData = query.data;
  const state = userState[chatId];

  if (queryData.startsWith("answer_") && state?.mode === "test") {
    const answerIndex = parseInt(queryData.replace("answer_", ""));
    const questions = TestsBank[state.book].units[state.unit];
    const currentQ = questions[state.currentQuestion];

    if (answerIndex === currentQ.correctIndex) {
      state.score += 1;
    }

    state.currentQuestion += 1;
    startTest(chatId);
  }
  //Test ishlash qismidagi kitoblar
  if (queryData === "test") {
    userState[chatId] = { mode: "test" };
    bot.sendMessage(chatId, `Quyidagi kitoblardan birini tanlang: `, {
      reply_markup: {
        inline_keyboard: TestBooks,
      },
    });
  }
  //  Test uchun unitlarni chiqarish
  if (
    queryData === "book1" ||
    queryData === "book2" ||
    queryData === "book3" ||
    queryData === "book4" ||
    queryData === "book5" ||
    queryData === "book6"
  ) {
    userState[chatId].book = queryData;

    bot.sendMessage(
      chatId,
      `Quyidagi mavzulardan birini tanlang : \n ${
        queryData === "book1"
          ? `Kitob : Essential English Words 1 ✅`
          : queryData === "book2"
          ? `Kitob : Essential English Words 2 ✅`
          : queryData === "book3"
          ? `Kitob : Essential English Words 3 ✅`
          : queryData === "book4"
          ? `Kitob : Essential English Words 4 ✅`
          : queryData === "book5"
          ? `Kitob : Essential English Words 5 ✅`
          : queryData === "book6"
          ? `Kitob : Essential English Words 6 ✅`
          : 0
      }`,
      {
        reply_markup: {
          inline_keyboard: unitsPage1,
        },
      }
    );
  }

  // Testni boshlash qismi
  if (queryData.startsWith("unit_") && userState[chatId]?.mode === "test") {
    userState[chatId].unit = queryData;
    userState[chatId].currentQuestion = 0;
    userState[chatId].score = 0;

    startTest(chatId);
  }
  if (queryData === "words") {
    // Soz yodlash qismidagi kitoblar qismi
    userState[chatId] = { mode: "words" };
    bot.sendMessage(chatId, `Quyidagi kitoblardan birini tanlang : `, {
      reply_markup: {
        inline_keyboard: Books,
      },
    });
  }

  // Soz yodlash qismidagi unitlar qismi
  if (
    queryData === "word1" ||
    queryData === "word2" ||
    queryData === "word3" ||
    queryData === "word4" ||
    queryData === "word5" ||
    queryData === "word6"
  ) {
    userState[chatId].book = queryData;
    bot.sendMessage(
      chatId,
      `Quyidagi mavzulardan birini tanlang : \n ${
        queryData === "word1"
          ? `Kitob : Essential English Words 1 ✅`
          : queryData === "word2"
          ? `Kitob : Essential English Words 2 ✅`
          : queryData === "word3"
          ? `Kitob : Essential English Words 3 ✅`
          : queryData === "word4"
          ? `Kitob : Essential English Words 4 ✅`
          : queryData === "word5"
          ? `Kitob : Essential English Words 5 ✅`
          : queryData === "word6"
          ? `Kitob : Essential English Words 6 ✅`
          : 0
      }`,
      {
        reply_markup: {
          inline_keyboard: unitsPage1,
        },
      }
    );
  }
  // Pagination qismi
  if (queryData.startsWith("page_")) {
    const keyboard = unitsPages[queryData];
    if (keyboard) {
      bot.editMessageReplyMarkup(
        { inline_keyboard: keyboard },
        { chat_id: chatId, message_id: query.message.message_id }
      );
    }
  }

  // Sozlarni tayyorlanish qismi
  if (queryData.startsWith("unit_") && userState[chatId]?.mode === "words") {
    const book = userState[chatId].book;
    const unitWords = WordsBank1[book].units[queryData];

    const text = unitWords
      .map((w, i) => `${i + 1}. ${w.en} - ${w.uz}`)
      .join("\n");

    bot.sendMessage(
      chatId,
      `🔷 ${WordsBank1[book].title}\n🔷 ${queryData}\n\n${text}`
    );
  }

  // Qollanma qismi
  if (queryData === "description") {
    // Qo'llanma qismi
    bot.sendMessage(
      chatId,
      "Hurmatli foydalanuvchi ushbu botimiz yordamida \nIngliz tilidagi Essential English Words kitobining barcha qismlaridagi \nso'zlarni  test yechish orqali tezroq o'rganishingiz mumkin \nSavol va takliflaringiz bo'lsa adminga murojaat qiling \nAdmin : @Aslonov_Davronbek"
    );
  }

  // Statistika qismi
  if (queryData === "stat") {
    const count = await User.countDocuments();
    bot.sendMessage(chatId, `👥 Jami foydalanuvchilar: ${count} ta`);
  }

  bot.answerCallbackQuery(query.id);
});
