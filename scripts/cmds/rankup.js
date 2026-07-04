const axios = require("axios");
const { Readable } = require("stream");

const RANKUP_GIF_URL = "https://images2.imgbox.com/6c/dd/nBFk2PuX_o.gif";
let cachedGifBuffer = null;

async function getGifBuffer() {
	if (cachedGifBuffer) return cachedGifBuffer;
	const response = await axios.get(RANKUP_GIF_URL, { responseType: "arraybuffer", timeout: 30000 });
	cachedGifBuffer = Buffer.from(response.data);
	console.log("[RANKUP] GIF cached successfully");
	return cachedGifBuffer;
}

getGifBuffer().catch(e => console.error("[RANKUP] Failed to pre-cache GIF:", e.message));

module.exports = {
  config: {
    name: "rankup",
    version: "1.1.2",
    author: "VincentSensei",
    description: {
      vi: "Thông báo rankup cho từng nhóm",
      en: "Rankup notification for each group",
    },
    category: "system",
    usage: "rankup [on/off]",
    role: 0,
  },

  langs: {
    vi: {
      on: "bật",
      off: "tắt",
      successText: "thành công thông báo rankup!",
      levelup: "★★ Chúc mừng {name} đã đạt level {level}",
    },
    en: {
      on: "on",
      off: "off",
      successText: "success notification rankup!",
      levelup: "★★ Congratulations {name} on reaching level {level}!",
    },
  },

  onStart: async function ({ api, event, threadsData, args, getLang }) {
    const { threadID, messageID } = event;

    if (!args[0]) {
      const rankupEnabled = await threadsData.get(
        threadID,
        "settings.rankupEnabled"
      );
      const status = rankupEnabled ? "ON" : "OFF";
      return api.sendMessage(
        `📊 Rankup Status: ${status}\nUse: rankup [on/off]`,
        threadID,
        messageID
      );
    }

    if (args[0] === "on" || args[0] === "off") {
      const isOn = args[0] === "on";
      await threadsData.set(threadID, isOn, "settings.rankupEnabled");

      const defaultMsg = getLang("levelup");
      await threadsData.set(threadID, defaultMsg, "data.rankup.message");

      return api.sendMessage(
        `${isOn ? getLang("on") : getLang("off")} ${getLang("successText")}`,
        threadID,
        messageID
      );
    }

    return api.sendMessage(`Usage: rankup [on/off]`, threadID, messageID);
  },

  onChat: async function ({
    api,
    event,
    usersData,
    threadsData,
    message,
    getLang,
  }) {
    const { threadID, senderID } = event;

    const rankupEnabled = await threadsData.get(
      threadID,
      "settings.rankupEnabled"
    );
    if (rankupEnabled === false) return;

    try {
      const userData = await usersData.get(senderID);
      const prevExp = userData?.data?.exp || 0;
      const exp = prevExp + 1;

      await usersData.set(senderID, exp, "data.exp");

      const expToLevel = (e) =>
        Math.floor((1 + Math.sqrt(1 + (8 * e) / 5)) / 2);

      const prevLevel = expToLevel(prevExp);
      const currentLevel = expToLevel(exp);

      if (currentLevel > prevLevel && currentLevel > 1) {
        const name = (await usersData.getName(senderID)) || "User";

        let rankupMessage = await threadsData.get(
          threadID,
          "data.rankup.message"
        );
        if (!rankupMessage) {
          rankupMessage = getLang("levelup");
        }

        rankupMessage = rankupMessage
          .replace(/{name}/g, name)
          .replace(/{level}/g, currentLevel)
          .replace(/{userName}/g, name);

        const form = {
          body: rankupMessage,
          mentions: [{ tag: name, id: senderID }],
        };

        try {
          const buf = await getGifBuffer();
          const stream = Readable.from(buf);
          stream.path = "rankup.gif";
          form.attachment = stream;
        } catch (e) {
          console.error("[RANKUP] Failed to fetch GIF:", e.message);
        }

        await message.send(form);
      }
    } catch (e) {
      console.error("[RANKUP] Error:", e.message);
    }
  },
};
