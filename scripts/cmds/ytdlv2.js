const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { Innertube, Platform } = require("youtubei.js");
const sytdl = require("shadowx-ytdl");

Platform.shim.eval = async (data) => new Function(data.output)();

let yt;

async function getYt() {
  if (!yt) yt = await Innertube.create({ generate_session_locally: true });
  return yt;
}

module.exports = {
  config: {
    name: "ytdlv2",
    version: "2.0.0",
    author: "Vincent Magtolis",
    countDown: 5,
    role: 0,
    shortDescription: { en: "YouTube downloader v2" },
    longDescription: { en: "Search YouTube with rich metadata and download MP4 video" },
    category: "media",
    guide: { en: "{pn} <title or URL>" },
  },

  onStart: async function ({ message, args, event }) {
    const query = args.join(" ");
    if (!query) return message.reply("❌ Enter a title or YouTube URL.");

    const processingMsg = await message.reply("🔍 Searching...");

    try {
      const client = await getYt();
      let videoId;

      if (/^https?:\/\//.test(query)) {
        try {
          const u = new URL(query);
          if (u.hostname === "youtu.be") videoId = u.pathname.slice(1);
          else if (u.hostname.includes("youtube.com")) videoId = u.searchParams.get("v");
        } catch {}
        if (!videoId) {
          await message.unsend(processingMsg.messageID);
          return message.reply("❌ Invalid YouTube URL.");
        }
      } else {
        const search = await client.search(query);
        const videos = search.videos || [];
        if (!videos.length) {
          await message.unsend(processingMsg.messageID);
          return message.reply("❌ No results found.");
        }
        videoId = videos[0].id;
      }

      const info = await client.getInfo(videoId);
      const basics = info.basic_info || {};
      const title = basics.title || "Unknown";
      const channel = basics.channel?.name || basics.author?.name || "Unknown";
      const duration = basics.duration || 0;

      if (duration > 600) {
        await message.unsend(processingMsg.messageID);
        return message.reply("⚠️ Only videos under 10 minutes.");
      }

      await message.unsend(processingMsg.messageID);
      await message.reaction("⏳", event.messageID);

      const qualities = [1080, 720, 480, 360];
      let result, dlUrl;
      for (const q of qualities) {
        result = await sytdl.downloadVideo(`https://youtube.com/watch?v=${videoId}`, q);
        if (result?.status && result?.download?.downloadUrl) {
          dlUrl = result.download.downloadUrl;
          break;
        }
      }
      if (!dlUrl) {
        message.reaction("❌", event.messageID);
        return message.reply("❌ Failed to get download link.");
      }

      const tmpFile = path.join(os.tmpdir(), `ytdlv2_${Date.now()}.mp4`);
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
        return message.reply(`🎬 ${filename}\n📥 Download (too large): ${dlUrl}`);
      }

      try {
        await message.reply({
          body: `🎬 ${title}\n📺 ${channel}`,
          attachment: fs.createReadStream(tmpFile),
        });
      } catch (sendErr) {
        console.error("[YTDLV2] Send error:", sendErr.message);
        fs.unlink(tmpFile).catch(() => {});
        return message.reply(`🎬 ${title}\n📥 Direct download: ${dlUrl}`);
      }

      fs.unlink(tmpFile).catch(() => {});
    } catch (error) {
      console.error("[YTDLV2] Error:", error.message);
      message.reaction("❌", event.messageID);
      await message.reply(`❌ Error: ${error.message}`);
    }
  },
};
