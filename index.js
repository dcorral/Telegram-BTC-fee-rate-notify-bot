require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedUserId = parseInt(process.env.USER_ID, 10);

if (!token || isNaN(allowedUserId)) {
  console.error("Please set TELEGRAM_BOT_TOKEN and USER_ID in your .env file.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

let minThreshold = 2;
let maxThreshold = 10;

let feeRateStatus = null; // 'inside', 'below', 'above'

async function getBitcoinFeeRate() {
  try {
    const response = await axios.get(
      "https://mempool.space/api/v1/fees/recommended",
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching Bitcoin fee rate:", error);
    return null;
  }
}

async function checkFeeRates() {
  const feeRates = await getBitcoinFeeRate();
  if (!feeRates) return;
  const currentFeeRate = feeRates.fastestFee;

  let currentStatus;
  if (currentFeeRate < minThreshold) {
    currentStatus = "below";
  } else if (currentFeeRate > maxThreshold) {
    currentStatus = "above";
  } else {
    currentStatus = "inside";
  }

  if (currentStatus !== feeRateStatus) {
    if (currentStatus === "below") {
      bot.sendMessage(
        allowedUserId,
        `🚨 Fee rate has dropped **below** your minimum threshold of ${minThreshold} sat/vByte.\n\nCurrent fee rate: ${currentFeeRate} sat/vByte.`,
      );
    } else if (currentStatus === "above") {
      bot.sendMessage(
        allowedUserId,
        `🚨 Fee rate has risen **above** your maximum threshold of ${maxThreshold} sat/vByte.\n\nCurrent fee rate: ${currentFeeRate} sat/vByte.`,
      );
    } else if (currentStatus === "inside") {
      bot.sendMessage(
        allowedUserId,
        `✅ Fee rate has moved **back inside** your thresholds.\n\nCurrent fee rate: ${currentFeeRate} sat/vByte.`,
      );
    }
    feeRateStatus = currentStatus;
  }
}

setInterval(checkFeeRates, 60 * 1000);

bot.onText(/\/min (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== allowedUserId) return;

  const threshold = parseInt(match[1], 10);

  if (isNaN(threshold) || threshold <= 0) {
    bot.sendMessage(
      chatId,
      `⚠️ Please provide a valid positive number for the minimum threshold.`,
    );
    return;
  }

  minThreshold = threshold;
  bot.sendMessage(
    chatId,
    `✅ Minimum threshold set to ${minThreshold} sat/vByte.`,
  );
});

bot.onText(/\/max (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId !== allowedUserId) return;

  const threshold = parseInt(match[1], 10);

  if (isNaN(threshold) || threshold <= 0) {
    bot.sendMessage(
      chatId,
      `⚠️ Please provide a valid positive number for the maximum threshold.`,
    );
    return;
  }

  maxThreshold = threshold;
  bot.sendMessage(
    chatId,
    `✅ Maximum threshold set to ${maxThreshold} sat/vByte.`,
  );
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== allowedUserId) return;

  const feeRates = await getBitcoinFeeRate();
  if (!feeRates) {
    bot.sendMessage(chatId, `❌ Unable to fetch current fee rate.`);
    return;
  }
  const currentFeeRate = feeRates.fastestFee;
  bot.sendMessage(
    chatId,
    `📊 Your settings:\n- Minimum threshold: ${minThreshold} sat/vByte\n- Maximum threshold: ${maxThreshold} sat/vByte\n\nCurrent fee rate: ${currentFeeRate} sat/vByte.`,
  );
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== allowedUserId) return;

  bot.sendMessage(
    chatId,
    `ℹ️ **Bitcoin Fee Rate Bot Commands**:\n\n- **/min <number>**: Set your minimum fee rate threshold in sat/vByte.\n- **/max <number>**: Set your maximum fee rate threshold in sat/vByte.\n- **/status**: Check your current thresholds and the current fee rate.\n\nThe bot will notify you when the fee rate crosses your thresholds.`,
  );
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== allowedUserId) return;

  if (!msg.text.startsWith("/")) {
    bot.sendMessage(
      chatId,
      `❓ Unknown command. Use /help to see available commands.`,
    );
  }
});
