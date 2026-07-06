const axios = require("axios");

module.exports = {
  config: {
    name: "jail",
    version: "1.0.0",
    role: 0,
    author: "AjiroDesu",
    description: "Put a photo or a user's avatar behind bars.",
    category: "fun",
    usage: "(reply to photo) | self | @mention | (reply to user)",
    countDown: 5,
  },

  onStart: async function ({ api, message, event }) {
    const senderID = event.senderID;
    const mentions = event.mentions || {};
    const mentionIDs = Object.keys(mentions);
    const messageReply = event.messageReply;

    try {
      let imageUrl;

      const repliedAttachments = messageReply?.attachments;
      const attachedImageUrl = repliedAttachments?.find(
        a => a.type === "photo" || a.type === "animated_image"
      )?.url;

      if (attachedImageUrl) {
        imageUrl = attachedImageUrl;
      } else {
        const targetID = mentionIDs[0] || messageReply?.senderID || senderID;
        try {
          const info = await api.getUserInfo(targetID);
          imageUrl = info[targetID]?.photo?.url || null;
        } catch {}
        if (!imageUrl) {
          return message.reply(
            "🔒 **How to use /jail (FB Page non-admin only):**\n" +
            "1️⃣ Send a photo in the conversation.\n" +
            "2️⃣ Reply to that photo with the command: `jail`\n" +
            "3️⃣ The bot will apply the effect to your uploaded photo.\n\n" +
            "⚠️ You must reply directly to the photo message."
          );
        }
      }

      const apiUrl = `https://api.popcat.xyz/v2/jail?image=${encodeURIComponent(imageUrl)}`;
      const res = await axios.get(apiUrl, { responseType: "arraybuffer", timeout: 30000 });
      const buffer = Buffer.from(res.data);

      const tempPath = __dirname + "/jail_temp.png";
      require("fs").writeFileSync(tempPath, buffer);
      const attachment = require("fs").createReadStream(tempPath);

      await message.reply({
        body: "🔒 **Busted!**",
        attachment,
      });

      require("fs").unlinkSync(tempPath);
    } catch (err) {
      message.reply(`⚠️ **Error:** ${err.message || "Unknown error"}`);
    }
  },
};
