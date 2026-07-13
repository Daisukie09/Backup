const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const ytsearch = require("yt-search");

const RAPIDAPI_KEY = "f5a15718e2msha1be8bbea46f76ep146606jsn8faef601eed8";
const RAPIDAPI_HOST = "youtube-mp36.p.rapidapi.com";
const RAPIDAPI_USER = "kirigayathunder";

module.exports = {
  config: {
    name: "music",
    version: "1.0.0",
    author: "John Lester",
    description: "Search and play music from YouTube",
    category: "media",
    usage: "<song name>",
    role: 0,
    countDown: 10,
  },

  onStart: async function ({ message, event, args }) {
    const query = args.join(" ");
    if (!query) {
      return message.reply("Usage: music <song name>");
    }

    const spin = await message.reply(`🔍 Searching for **${query}**...`);

    try {
      const search = await ytsearch(query);
      if (!search.videos.length) {
        await message.unsend(spin.messageID);
        return message.reply("❌ No results found.");
      }

      const video = search.videos[0];
      const videoId = video.videoId;

      await message.unsend(spin.messageID);
      const converting = await message.reply(`⏳ Converting **${video.title}** to MP3...`);

      const apiUrl = `https://${RAPIDAPI_HOST}/dl?id=${videoId}`;
      const conv = await axios.get(apiUrl, {
        headers: {
          "x-rapidapi-host": RAPIDAPI_HOST,
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
        timeout: 30000,
      });

      if (conv.data.status !== "ok" || !conv.data.link) {
        await message.unsend(converting.messageID);
        return message.reply("❌ Failed to convert video.");
      }

      const mp3Url = conv.data.link;
      const dur = Math.floor(conv.data.duration);
      const mins = Math.floor(dur / 60);
      const secs = dur % 60;

      const fileName = `${video.title.replace(/[/\\?%*:|"<>]/g, "-")}.mp3`;
      const filePath = path.join(__dirname, fileName);

      const dl = await axios.get(mp3Url, {
        responseType: "stream",
        timeout: 120000,
        headers: {
          "User-Agent": `Mozilla/5.0 ${RAPIDAPI_USER}`,
        },
      });

      const writer = fs.createWriteStream(filePath);
      dl.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      await message.unsend(converting.messageID);

      await message.reply({
        body:
          `🎵 **${video.title}**\n` +
          `👤 ${video.author?.name || "Unknown"}\n` +
          `⏱️ ${mins}:${String(secs).padStart(2, "0")}\n` +
          `📊 ${video.views?.toLocaleString() || "?"} views`,
        attachment: fs.createReadStream(filePath),
      });

      fs.unlinkSync(filePath);
    } catch (e) {
      await message.unsend(spin.messageID).catch(() => {});
      message.reply(`❌ Error: ${e.message}`);
    }
  },
};
