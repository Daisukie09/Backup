const axios = require("axios");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");
const ytSearch = require("yt-search");

const RAPIDAPI_KEY = "f5a15718e2msha1be8bbea46f76ep146606jsn8faef601eed8";
const RAPIDAPI_HOST = "ytdl-api.p.rapidapi.com";

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

async function getDownloadUrl(videoUrl) {
  const res = await axios.get(`https://${RAPIDAPI_HOST}/youtubedownloader2`, {
    params: { url: videoUrl },
    headers: {
      "X-Rapidapi-Key": RAPIDAPI_KEY,
      "X-Rapidapi-Host": RAPIDAPI_HOST,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
  return res.data;
}

module.exports = {
  config: {
    name: "ytdl",
    version: "2.0.0",
    author: "Vincent Magtolis",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Download YouTube video" },
    longDescription: { en: "Download YouTube video or audio via RapidAPI" },
    category: "media",
    guide: { en: "{pn} <title> - Search and download\n{pn} <url> - Download video" },
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
      if (duration > 600) { await message.reply("⚠️ Only videos under 10 minutes are supported."); return; }

      await message.unsend(processingMsg.messageID);
      await message.reaction("⏳", event.messageID);

      const data = await getDownloadUrl(`https://www.youtube.com/watch?v=${videoId}`);

      if (!data?.download_url && !data?.link && !data?.url) {
        message.reaction("❌", event.messageID);
        await message.reply("❌ Failed to get download link.");
        return;
      }

      const dlUrl = data.download_url || data.link || data.url;
      const tmpFile = path.join(os.tmpdir(), `ytdl_${Date.now()}.mp4`);

      const fileRes = await axios.get(dlUrl, {
        responseType: "stream",
        timeout: 120000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });

      await pipeline(fileRes.data, fs.createWriteStream(tmpFile));
      message.reaction("✅", event.messageID);

      const info = `🎬 𝐘𝐎𝐔𝐓𝐔𝐁𝐄 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃\n\n📌 Title: ${topResult.title}\n⏱️ Duration: ${topResult.timestamp}\n📺 Channel: ${topResult.author.name}`;

      await message.reply({ body: info, attachment: fs.createReadStream(tmpFile) });
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
