const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const axios = require("axios");
const ytSearch = require("yt-search");
const sytdl = require("shadowx-ytdl");

function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
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
    version: "4.0.0",
    author: "Vincent Magtolis",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Download YouTube video as MP4" },
    longDescription: { en: "Search and download YouTube videos in HD MP4 format" },
    category: "media",
    guide: { en: "{pn} <title or URL>" },
  },

  onStart: async function ({ message, args, event }) {
    try {
      const query = args.join(" ");
      if (!query) return message.reply("❌ Enter a title or YouTube URL.");

      const processingMsg = await message.reply("🔍 Searching...");

      let videoUrl;
      if (/^https?:\/\//.test(query)) {
        videoUrl = cleanUrl(query);
        if (!extractVideoId(videoUrl)) {
          await message.unsend(processingMsg.messageID);
          return message.reply("❌ Invalid YouTube URL.");
        }
      } else {
        const results = await ytSearch(query);
        if (!results?.videos?.length) {
          await message.unsend(processingMsg.messageID);
          return message.reply("❌ No results found.");
        }
        videoUrl = results.videos[0].url;
      }

      await message.unsend(processingMsg.messageID);
      await message.reaction("⏳", event.messageID);

      const qualities = [1080, 720, 480, 360];
      let result, dlUrl;
      for (const q of qualities) {
        result = await sytdl.downloadVideo(videoUrl, q);
        if (result?.status && result?.download?.downloadUrl) {
          dlUrl = result.download.downloadUrl;
          break;
        }
      }
      if (!dlUrl) {
        message.reaction("❌", event.messageID);
        return message.reply("❌ Failed to get download link.");
      }

      const tmpFile = path.join(os.tmpdir(), `ytdl_${Date.now()}.mp4`);
      const dl = await axios.get(dlUrl, {
        responseType: "stream",
        timeout: 120000,
        headers: { "User-Agent": "Mozilla/5.0" },
        validateStatus: s => s === 200,
      });

      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(tmpFile);
        dl.data.pipe(w);
        w.on("finish", resolve);
        w.on("error", reject);
      });

      const stat = fs.statSync(tmpFile);
      if (stat.size < 1024) {
        fs.unlink(tmpFile).catch(() => {});
        message.reaction("❌", event.messageID);
        return message.reply("❌ Downloaded file is empty or invalid.");
      }

      message.reaction("✅", event.messageID);

      const filename = result.download.filename || "Video.mp4";
      if (stat.size > 25 * 1024 * 1024) {
        fs.unlink(tmpFile).catch(() => {});
        return message.reply(`🎬 ${filename}\n📥 Download (too large for direct send): ${dlUrl}`);
      }

      try {
        await message.reply({
          body: `🎬 ${filename}`,
          attachment: fs.createReadStream(tmpFile),
        });
      } catch (sendErr) {
        console.error("[YTDL] Send error:", sendErr.message);
        fs.unlink(tmpFile).catch(() => {});
        return message.reply(`🎬 ${filename}\n📥 Direct download: ${dlUrl}`);
      }

      fs.unlink(tmpFile).catch(() => {});
    } catch (error) {
      console.error("[YTDL] Error:", error.message);
      message.reaction("❌", event.messageID);
      await message.reply(`❌ Error: ${error.message}`);
    }
  },
};
