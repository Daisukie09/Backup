const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

function formatViews(views) {
  return views.toLocaleString("en-US");
}

function cleanLyrics(raw) {
  return raw.replace(/^\d+\s+Contributors.+?Lyrics/s, "").trim();
}

const LYRICS_SPLIT_THRESHOLD = 800;

module.exports = {
  config: {
    name: "playlyrics",
    aliases: ["pl", "plyr"],
    version: "1.0.0",
    role: 0,
    author: "AjiroDesu",
    description: "Search YouTube and send the top result as an MP3 with matching song lyrics.",
    category: "media",
    usage: "<song name>",
    countDown: 10,
  },

  onStart: async function ({ api, message, event, args }) {
    const query = args.join(" ");
    if (!query) {
      return message.reply("❌ Please provide a song name to search.");
    }

    const waitMsg = await message.reply(`🔍 Searching for **${query}**...`);

    try {
      const audioApiUrl = `https://api.cuki.biz.id/api/search/playyt?query=${encodeURIComponent(query)}&apikey=free`;
      const lyricsApiUrl = `https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(query)}`;

      const [audioInfoResult, lyricsResult] = await Promise.allSettled([
        axios.get(audioApiUrl, { timeout: 30000 }),
        axios.get(lyricsApiUrl, { timeout: 30000 }),
      ]);

      if (audioInfoResult.status === "rejected") {
        throw new Error(audioInfoResult.reason?.message || "Audio fetch failed.");
      }

      const json = audioInfoResult.value.data;
      if (!json.success || !json.data) {
        throw new Error("The Play API returned an unsuccessful response.");
      }

      const { video, download } = json.data;
      if (!download.success || !download.audio?.url) {
        throw new Error("No downloadable audio found for that query.");
      }

      const audio = download.audio;

      if (waitMsg) {
        api.unsendMessage(waitMsg.messageID);
      }

      const audioRes = await axios.get(audio.directLink || audio.url, {
        responseType: "arraybuffer",
        timeout: 60000,
      });
      const audioBuffer = Buffer.from(audioRes.data);

      let lyricsBlock = "_Lyrics unavailable for this track._";
      if (lyricsResult.status === "fulfilled") {
        const lyricsJson = lyricsResult.value.data;
        if (!lyricsJson.error && lyricsJson.message?.lyrics) {
          lyricsBlock = cleanLyrics(lyricsJson.message.lyrics);
        }
      }

      const audioCaption = [
        `🎵 **${video.title}**`,
        ``,
        `👤 **Channel:** ${video.author.name}`,
        `⏱️ **Duration:** ${video.duration.formatted}`,
        `👁️ **Views:** ${formatViews(video.views)}`,
        `📅 **Uploaded:** ${video.uploaded}`,
        `🔊 **Quality:** ${audio.bitrate} · ${audio.format.toUpperCase()}`,
        `🔗 **YouTube:** ${video.url}`,
      ].join("\n");

      const fileName = `${video.title.replace(/[/\\?%*:|"<>]/g, "-")}.mp3`;
      const filePath = path.join(__dirname, fileName);
      fs.writeFileSync(filePath, audioBuffer);

      const attachment = fs.createReadStream(filePath);

      if (lyricsBlock.length <= LYRICS_SPLIT_THRESHOLD) {
        await message.reply({
          body: `${audioCaption}\n\n📝 **Lyrics**\n${lyricsBlock}`,
          attachment,
        });
      } else {
        await message.reply({
          body: audioCaption,
          attachment,
        });
        await message.reply(`📝 **Lyrics — ${video.title}**\n\n${lyricsBlock}`);
      }

      fs.unlinkSync(filePath);
    } catch (err) {
      if (waitMsg) {
        api.unsendMessage(waitMsg.messageID);
      }
      message.reply(`❌ **Failed to process your request.**\n\`${err.message || "Unknown error"}\``);
    }
  },
};
