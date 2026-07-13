const axios = require("axios");

module.exports = {
  config: {
    name: "spamshare",
    version: "2.0.0",
    role: 0,
    author: "Vincent Magtolis",
    description: "Spam share a Facebook post using cookie.",
    category: "Tools",
    usage: "cookie | link | amount",
    countDown: 5,
  },

  onStart: async function ({ message, event, args }) {
    const input = args.join(" ").split("|").map(s => s.trim());
    const [cookie, link, amountStr] = input;

    if (!cookie || !link || !amountStr) {
      return message.reply("Usage: spamshare cookie | link | amount\nExample: spamshare c_user=xxx;xs=xxx | https://facebook.com/post | 10");
    }

    const num = parseInt(amountStr);
    if (isNaN(num) || num < 1) return message.reply("❌ Amount must be a positive number.");

    const apiUrl = `https://spamxshare.onrender.com/ap/share?cookie=${encodeURIComponent(cookie)}&link=${encodeURIComponent(link)}&amount=${num}&delay=1`;

    try {
      const res = await axios.get(apiUrl, { timeout: 300000 });
      const result = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      message.reply(`📤 Spam Share Result:\n${result.slice(0, 2000)}`);
    } catch (error) {
      message.reply(`❌ Error: ${error.message}`);
    }
  },
};
