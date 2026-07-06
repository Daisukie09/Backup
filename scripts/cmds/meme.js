const axios = require("axios");

module.exports = {
  config: {
    name: "meme",
    aliases: ["memes", "randommeme"],
    version: "1.1.0",
    role: 0,
    author: "ShawnDesu",
    description: "Sends a random meme.",
    category: "random",
    usage: "",
    countDown: 5,
  },

  onStart: async function ({ message, event }) {
    try {
      const { data } = await axios.get("https://meme-api.com/gimme/memes", { timeout: 10000 });
      if (!data?.url || !data?.title) throw new Error("Invalid meme data");

      const url = data.url;
      const title = data.title;

      const res = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
      const tempPath = __dirname + "/meme_temp.jpg";
      require("fs").writeFileSync(tempPath, Buffer.from(res.data));
      const attachment = require("fs").createReadStream(tempPath);

      await message.reply({
        body: `😂 **${title}**`,
        attachment,
      });

      require("fs").unlinkSync(tempPath);
    } catch (err) {
      message.reply("⚠️ Failed to fetch a meme. Please try again.");
    }
  },
};
