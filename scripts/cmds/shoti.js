const axios = require("axios");
const Shoti = require("shoti");

const SENDER_CD = new Map();
const CD_SECONDS = 15;

let shotiClient;

function getClient() {
  if (!shotiClient) {
    const key = global.GoatBot?.config?.shotiApiKey;
    shotiClient = key ? new Shoti(key) : new Shoti();
  }
  return shotiClient;
}

module.exports = {
  config: {
    name: "shoti",
    version: "1.0.0",
    author: "VincentSensei",
    description: "Send a random TikTok video",
    category: "media",
    usage: "shoti",
    role: 0,
    countDown: 10,
  },

  onStart: async function ({ api, event, message, args }) {
    const { senderID } = event;

    const lastUse = SENDER_CD.get(senderID);
    if (lastUse && Date.now() - lastUse < CD_SECONDS * 1000) {
      const remain = CD_SECONDS - Math.floor((Date.now() - lastUse) / 1000);
      return message.reply(`⏳ Please wait ${remain}s before using again.`);
    }

    SENDER_CD.set(senderID, Date.now());

    const spin = await message.reply("🎲 Searching for a Shoti video...");

    try {
      const data = await getClient().getShoti({ type: "video" });

      if (!data || !data.content) {
        await message.unsend(spin.messageID);
        return message.reply("❌ No video found. Try again later.");
      }

      const { content: videoUrl, user, title, region, duration } = data;
      const nickname = user?.nickname || "Unknown";
      const username = user?.username || "unknown";

      const infoMsg =
        `🎬 **TikTok Video**\n` +
        `📹 **User:** ${nickname} (@${username})\n` +
        (title ? `📝 **Title:** ${title}\n` : "") +
        (region ? `🌍 **Region:** ${region}\n` : "") +
        `⏱️ **Duration:** ${Math.floor(parseInt(duration || 0) / 1000)}s`;

      await message.unsend(spin.messageID);

      const resp = await axios.get(videoUrl, {
        responseType: "stream",
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 12; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
          Referer: "https://www.tiktok.com/",
          Origin: "https://www.tiktok.com",
        },
      });
      resp.data.path = "shoti_video.mp4";

      await message.reply({
        body: infoMsg,
        attachment: resp.data,
      });
    } catch (e) {
      await message.unsend(spin.messageID).catch(() => {});
      message.reply(`❌ Error: ${e.message}`);
    }
  },
};
