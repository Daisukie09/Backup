const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const axios = require("axios");
const ytSearch = require("yt-search");
const sytdl = require("shadowx-ytdl");

const RAPIDAPI_KEY = "f5a15718e2msha1be8bbea46f76ep146606jsn8faef601eed8";

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

async function downloadViaRapidApi(videoId, quality) {
  const apiUrl = `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`;
  const conv = await axios.get(apiUrl, {
    headers: { "x-rapidapi-host": "youtube-mp36.p.rapidapi.com", "x-rapidapi-key": RAPIDAPI_KEY },
    timeout: 30000,
  });
  if (conv.data?.status !== "ok" || !conv.data?.link) return null;
  const qualStr = `${quality}kbps`;
  return {
    downloadUrl: conv.data.link,
    filename: `${conv.data.title || "audio"} (${qualStr}).mp3`,
    title: conv.data.title || "Audio",
  };
}

module.exports = {
  config: {
    name: "ytdl",
    version: "3.2.0",
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

      let videoUrl, videoId;
      if (/^https?:\/\//.test(query)) {
        videoUrl = cleanUrl(query);
        videoId = extractVideoId(videoUrl);
      } else {
        const results = await ytSearch(query);
        if (!results?.videos?.length) {
          await message.unsend(processingMsg.messageID);
          return message.reply("❌ No results found.");
        }
        const top = results.videos[0];
        videoUrl = top.url;
        videoId = top.videoId;
      }

      if (!videoId) {
        await message.unsend(processingMsg.messageID);
        return message.reply("❌ Invalid YouTube URL.");
      }

      await message.unsend(processingMsg.messageID);
      await message.reaction("⏳", event.messageID);

      let downloadInfo = null;

      // Try shadowx-ytdl first (best for MP4)
      const qualMP4 = [144, 360, 480, 720, 1080].includes(quality) ? quality : 1080;
      const qualMP3 = [92, 128, 256, 320].includes(quality) ? quality : 320;

      if (format === "mp4") {
        const result = await sytdl.downloadVideo(videoUrl, qualMP4);
        if (result?.status && result?.download?.downloadUrl) {
          downloadInfo = { downloadUrl: result.download.downloadUrl, filename: result.download.filename, title: result.download.filename };
        }
      } else {
        // Try shadowx first for MP3 too
        const result = await sytdl.downloadAudio(videoUrl, qualMP3);
        if (result?.status && result?.download?.downloadUrl) {
          downloadInfo = { downloadUrl: result.download.downloadUrl, filename: result.download.filename, title: result.download.filename };
        }
        // Fallback to RapidAPI MP3
        if (!downloadInfo) {
          const fallback = await downloadViaRapidApi(videoId, qualMP3);
          if (fallback) downloadInfo = fallback;
        }
      }

      if (!downloadInfo) {
        message.reaction("❌", event.messageID);
        return message.reply("❌ Failed to get download link. The download service may be blocked on this server.");
      }

      const ext = format === "mp3" ? "mp3" : "mp4";
      const tmpFile = path.join(os.tmpdir(), `ytdl_${Date.now()}.${ext}`);
      const dl = await axios.get(downloadInfo.downloadUrl, {
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
        body: `🎬 ${downloadInfo.title || "Video"}`,
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
