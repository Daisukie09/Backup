const getFBInfo = require("@xaviabot/fb-downloader");
const axios = require("axios");

module.exports = {
  config: {
    name: "fbdl",
    version: "1.0.0",
    author: "VincentSensei",
    description: "Download Facebook videos",
    category: "media",
    usage: "fbdl <url>",
    role: 0,
    countDown: 10,
  },

  onStart: async function ({ message, event, args }) {
    const url = args[0];
    if (!url) {
      return message.reply("Usage: fbdl <Facebook video URL>");
    }
    if (!url.includes("facebook.com") && !url.includes("fb.watch") && !url.includes("fb.com")) {
      return message.reply("Please provide a valid Facebook video URL.");
    }

    const spin = await message.reply("⏳ Downloading Facebook video...");

    try {
      const result = await getFBInfo(url);

      if (!result || (!result.sd && !result.hd)) {
        await message.unsend(spin.messageID);
        return message.reply("❌ Could not fetch video. Facebook may require authentication.");
      }

      const videoUrl = result.hd || result.sd;
      const title = result.title ? result.title.replace(/&amp;/g, "&").replace(/&#x?\w+;/g, "") : "Facebook Video";

      await message.unsend(spin.messageID);

      const resp = await axios.get(videoUrl, { responseType: "stream", timeout: 60000 });
      resp.data.path = "fb_video.mp4";

      await message.reply({
        body: `📹 **${title}**`,
        attachment: resp.data,
      });
    } catch (e) {
      await message.unsend(spin.messageID).catch(() => {});
      message.reply(`❌ Error: ${e.message || "Unable to fetch video."}`);
    }
  },
};
