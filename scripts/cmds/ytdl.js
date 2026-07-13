const axios = require("axios");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const ytSearch = require("yt-search");

const RAPIDAPI_KEY = "f5a15718e2msha1be8bbea46f76ep146606jsn8faef601eed8";

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch { return null; }
}

function cleanUrl(url) {
  const s = url.match(/youtube\.com\/shorts\/([\w-]+)/);
  if (s) return `https://www.youtube.com/watch?v=${s[1]}`;
  const id = extractVideoId(url);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  return url;
}

module.exports = {
  config: {
    name: "ytdl",
    version: "2.0.0",
    author: "Vincent Magtolis",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Download YouTube audio" },
    longDescription: { en: "Search and download YouTube audio as MP3" },
    category: "media",
    guide: { en: "{pn} <title or URL>" },
  },

  onStart: async function ({ message, args, event }) {
    let videoId, topResult;
    const processingMsg = await message.reply("🔍 Searching...");

    try {
      const isUrl = /^https?:\/\//.test(args[0]);

      if (isUrl) {
        const cleanInputUrl = cleanUrl(args[0]);
        videoId = extractVideoId(cleanInputUrl);
        if (!videoId) { await message.reply("❌ Invalid YouTube URL."); return; }
        const results = await ytSearch(videoId);
        if (!results?.videos?.length) { await message.reply("❌ No results found."); return; }
        topResult = results.videos[0];
      } else {
        const query = args.join(" ");
        if (!query) { await message.reply("❌ Enter a title or YouTube URL."); return; }
        const results = await ytSearch(query);
        if (!results?.videos?.length) { await message.reply("❌ No results found."); return; }
        topResult = results.videos[0];
        videoId = topResult.videoId;
      }

      const parts = topResult.timestamp.split(":").map(Number);
      const duration = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
      if (duration > 600) { await message.reply("⚠️ Only videos under 10 minutes."); return; }

      await message.unsend(processingMsg.messageID);
      await message.reaction("⏳", event.messageID);

      const apiUrl = `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`;
      const conv = await axios.get(apiUrl, {
        headers: {
          "x-rapidapi-host": "youtube-mp36.p.rapidapi.com",
          "x-rapidapi-key": RAPIDAPI_KEY,
        },
        timeout: 30000,
      });

      if (conv.data?.status !== "ok" || !conv.data?.link) {
        message.reaction("❌", event.messageID);
        await message.reply("❌ Failed to convert. The video may be restricted.");
        return;
      }

      const tmpFile = path.join(os.tmpdir(), `ytdl_${Date.now()}.mp3`);
      const dl = await axios.get(conv.data.link, {
        responseType: "stream",
        timeout: 120000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });

      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(tmpFile);
        dl.data.pipe(w);
        w.on("finish", resolve);
        w.on("error", reject);
      });

      message.reaction("✅", event.messageID);

      await message.reply({
        body: `🎬 ${topResult.title}\n⏱️ ${topResult.timestamp}  |  📺 ${topResult.author.name}`,
        attachment: fs.createReadStream(tmpFile),
      });

      fs.unlink(tmpFile).catch(() => {});
    } catch (error) {
      console.error("[YTDL] Error:", error.message);
      message.reaction("❌", event.messageID);
      await message.reply(`❌ Error: ${error.message}`);
    } finally {
      try { await message.unsend(processingMsg.messageID); } catch {}
    }
  },
};
