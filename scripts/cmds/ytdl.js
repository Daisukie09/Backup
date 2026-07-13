const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const axios = require("axios");
const ytdl = require("shadowx-ytdl");

module.exports = {
  config: {
    name: "ytdl",
    version: "3.1.0",
    author: "Vincent Magtolis",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Download YouTube video/audio" },
    longDescription: { en: "Search and download YouTube videos as MP4 or audio as MP3" },
    category: "media",
    guide: { en: "{pn} <title or URL> | {pn} <title or URL> -mp3 | {pn} <title or URL> -mp4 -quality 720" },
  },

  onStart: async function ({ message, args, event }) {
    try {
      let format = "mp4";
      let quality = 1080;
      const queryParts = [];

      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-mp3") format = "mp3";
        else if (args[i] === "-mp4") format = "mp4";
        else if (args[i] === "-quality" && args[i + 1]) { quality = parseInt(args[i + 1]); i++; }
        else queryParts.push(args[i]);
      }

      const query = queryParts.join(" ");
      if (!query) return message.reply("❌ Enter a title or YouTube URL.");

      const processingMsg = await message.reply("🔍 Searching...");

      let videoUrl;
      if (/^https?:\/\//.test(query)) {
        videoUrl = query;
      } else {
        const search = await ytdl.searchYouTube(query);
        if (!search?.results?.length) {
          await message.unsend(processingMsg.messageID);
          return message.reply("❌ No results found.");
        }
        videoUrl = search.results[0].url;
      }

      await message.unsend(processingMsg.messageID);
      await message.reaction("⏳", event.messageID);

      const qualMP3 = [92, 128, 256, 320].includes(quality) ? quality : 320;
      const qualMP4 = [144, 360, 480, 720, 1080].includes(quality) ? quality : 1080;
      const qual = format === "mp3" ? qualMP3 : qualMP4;
      const result = format === "mp3"
        ? await ytdl.downloadAudio(videoUrl, qual)
        : await ytdl.downloadVideo(videoUrl, qual);

      if (!result?.status || !result?.download?.downloadUrl) {
        message.reaction("❌", event.messageID);
        return message.reply("❌ Failed to get download link.");
      }

      const ext = format === "mp3" ? "mp3" : "mp4";
      const tmpFile = path.join(os.tmpdir(), `ytdl_${Date.now()}.${ext}`);
      const dl = await axios.get(result.download.downloadUrl, {
        responseType: "stream",
        timeout: 120000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(tmpFile);
        dl.data.pipe(w);
        w.on("finish", resolve);
        w.on("error", reject);
      });

      message.reaction("✅", event.messageID);

      await message.reply({
        body: `🎬 ${result.download.filename || "Video"}`,
        attachment: fs.createReadStream(tmpFile),
      });

      fs.unlink(tmpFile).catch(() => {});
    } catch (error) {
      console.error("[YTDL] Error:", error.message);
      message.reaction("❌", event.messageID);
      await message.reply(`❌ Error: ${error.message}`);
    }
  },
};
