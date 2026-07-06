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

const DELTA_NEXT = 5;

function expToLevel(exp) {
  if (exp <= 0) return 0;
  return Math.floor((1 + Math.sqrt(1 + (8 * exp) / DELTA_NEXT)) / 2);
}

function levelToExp(level) {
  if (level <= 0) return 0;
  return Math.floor(((level * level - level) * DELTA_NEXT) / 2);
}

module.exports = {
  config: {
    name: "rankup",
    version: "1.2.0",
    author: "John Lester",
    description: {
      vi: "Thông báo rankup cho từng nhóm",
      en: "Rankup notification for each group",
    },
    category: "system",
    usage: "rankup [on/off/check]",
    role: 0,
  },

  langs: {
    vi: {
      on: "bật",
      off: "tắt",
      successText: "thành công thông báo rankup!",
      levelup: "★★ Chúc mừng {name} đã đạt level {level}",
      statusOn: "Bật",
      statusOff: "Tắt",
      statusMsg: "📊 Trạng thái Rankup: {status}\nDùng: rankup [on/off/check]",
      checkTitle: "🃏 Xem trước thẻ rank",
      checkExp: "⭐ Cấp **{level}** — {exp} tổng EXP",
      myLevelBtn: "📊 Cấp của tôi",
      rankInfo: "⭐ **Cấp {level}** — {exp} tổng EXP (Hạng #{rank})",
    },
    en: {
      on: "on",
      off: "off",
      successText: "success notification rankup!",
      levelup: "★★ Congratulations {name} on reaching level {level}!",
      statusOn: "On",
      statusOff: "Off",
      statusMsg: "📊 Rankup Status: {status}\nUse: rankup [on/off/check]",
      checkTitle: "🃏 Rank Card Preview",
      checkExp: "⭐ **Level {level}** — {exp} total EXP",
      myLevelBtn: "📊 My Level",
      rankInfo: "⭐ **Level {level}** — {exp} total EXP (Rank #{rank})",
    },
  },

  onStart: async function ({ api, event, threadsData, usersData, args, getLang, message }) {
    const { threadID, senderID } = event;
    const sub = (args[0] || "").toLowerCase();

    if (sub === "check") {
      const userData = await usersData.get(senderID);
      const exp = userData?.data?.exp || 0;
      const level = expToLevel(exp);

      let leaderboardRank = 1;
      try {
        const allUsers = await usersData.getAll();
        const sorted = allUsers
          .map(u => ({ id: u.userID, exp: u?.data?.exp || 0 }))
          .sort((a, b) => b.exp - a.exp);
        const pos = sorted.findIndex(u => u.id == senderID);
        if (pos !== -1) leaderboardRank = pos + 1;
      } catch {}

      let userName = "User";
      try {
        const info = await api.getUserInfo(senderID);
        userName = info[senderID]?.name || "User";
      } catch {}

      let rankupMessage = getLang("levelup")
        .replace(/{name}/g, userName)
        .replace(/{level}/g, level || 1);

      const form = {
        body: `${getLang("checkTitle")}\n${rankupMessage}\n${getLang("rankInfo").replace("{level}", String(level || 1)).replace("{exp}", String(exp || 0)).replace("{rank}", String(leaderboardRank))}`,
        mentions: [{ tag: userName, id: senderID }],
      };

      try {
        const buf = await getGifBuffer();
        const stream = Readable.from(buf);
        stream.path = "rankup.gif";
        form.attachment = stream;
      } catch (e) {
        console.error("[RANKUP] Failed to fetch GIF:", e.message);
      }

      return message.send(form);
    }

    if (sub === "on" || sub === "off") {
      const isOn = sub === "on";
      await threadsData.set(threadID, isOn, "settings.rankupEnabled");

      const defaultMsg = getLang("levelup");
      await threadsData.set(threadID, defaultMsg, "data.rankup.message");

      return api.sendMessage(
        `${isOn ? getLang("on") : getLang("off")} ${getLang("successText")}`,
        threadID,
        event.messageID
      );
    }

    const rankupEnabled = await threadsData.get(threadID, "settings.rankupEnabled");
    const status = rankupEnabled !== false ? getLang("statusOn") : getLang("statusOff");
    return api.sendMessage(
      getLang("statusMsg").replace("{status}", status),
      threadID,
      event.messageID
    );
  },

  onChat: async function ({ api, event, usersData, threadsData, message, getLang }) {
    const { threadID, senderID } = event;

    const rankupEnabled = await threadsData.get(threadID, "settings.rankupEnabled");
    if (rankupEnabled === false) return;

    try {
      const userData = await usersData.get(senderID);
      const prevExp = userData?.data?.exp || 0;
      const exp = prevExp + 1;

      await usersData.set(senderID, exp, "data.exp");

      const prevLevel = expToLevel(prevExp);
      const currentLevel = expToLevel(exp);

      if (currentLevel > prevLevel && currentLevel > 1) {
        let userName = "User";
        try {
          const info = await api.getUserInfo(senderID);
          userName = info[senderID]?.name || "User";
        } catch {}

        let leaderboardRank = 1;
        try {
          const allUsers = await usersData.getAll();
          const sorted = allUsers
            .map(u => ({ id: u.userID, exp: u?.data?.exp || 0 }))
            .sort((a, b) => b.exp - a.exp);
          const pos = sorted.findIndex(u => u.id == senderID);
          if (pos !== -1) leaderboardRank = pos + 1;
        } catch {}

        let rankupMessage = getLang("levelup");
        const storedMsg = await threadsData.get(threadID, "data.rankup.message");
        if (storedMsg && storedMsg.includes("{name}")) {
          rankupMessage = storedMsg;
        }

        rankupMessage = rankupMessage
          .replace(/{name}/g, userName)
          .replace(/{level}/g, currentLevel)
          .replace(/{userName}/g, userName)
          .replace(/{@name}/g, `@${userName}`);

        const form = {
          body: `${rankupMessage}\n${getLang("rankInfo").replace("{level}", String(currentLevel)).replace("{exp}", String(exp)).replace("{rank}", String(leaderboardRank))}`,
          mentions: [{ tag: userName, id: senderID }],
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
