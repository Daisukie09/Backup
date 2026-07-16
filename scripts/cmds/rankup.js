const axios = require("axios");

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
    version: "1.4.0",
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
      levelup: "★★ Chúc mừng {userName} đã đạt level {level}",
      statusOn: "Bật",
      statusOff: "Tắt",
      statusMsg: "📊 Trạng thái Rankup: {status}\nDùng: rankup [on/off/check]",
      checkTitle: "🃏 Rankup Card",
    },
    en: {
      on: "on",
      off: "off",
      successText: "success notification rankup!",
      levelup: "★★ Congratulations {userName} on reaching level {level}!",
      statusOn: "On",
      statusOff: "Off",
      statusMsg: "📊 Rankup Status: {status}\nUse: rankup [on/off/check]",
      checkTitle: "🃏 Rankup Card",
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
      let avatarUrl = "";
      try {
        avatarUrl = await usersData.getAvatarUrl(senderID);
        const dbName = await usersData.getName(senderID);
        if (dbName) userName = dbName;
        else {
          const info = await api.getUserInfo(senderID);
          userName = info[senderID]?.name || "User";
        }
      } catch {}

      try {
        const canvasUrl = `https://betadash-api-swordslush-production.up.railway.app/api/rankup-v2?uid=${senderID}`;
        const resp = await axios.get(canvasUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const { Readable } = require("stream");
        const stream = Readable.from(Buffer.from(resp.data));
        stream.path = "rankup.png";
        return message.send({
          body: `${getLang("checkTitle")}\n${getLang("levelup").replace(/{userName}/g, userName).replace(/{level}/g, level || 1)}`,
          attachment: stream,
          mentions: [{ tag: userName, id: senderID }],
        });
      } catch (e) {
        console.error("[RANKUP] Canvas failed:", e.message);
        return message.send({
          body: `${getLang("checkTitle")}\n${getLang("levelup").replace(/{userName}/g, userName).replace(/{level}/g, level || 1)}\n⭐ **Level ${level || 1}** — ${exp} total EXP (Rank #${leaderboardRank})`,
          mentions: [{ tag: userName, id: senderID }],
        });
      }
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

    if (senderID == api.getCurrentUserID()) return;

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
        let avatarUrl = "";
        try {
          avatarUrl = await usersData.getAvatarUrl(senderID);
          const dbName = await usersData.getName(senderID);
          if (dbName) userName = dbName;
          else {
            const info = await api.getUserInfo(senderID);
            userName = info[senderID]?.name || "User";
          }
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
        if (storedMsg && storedMsg.includes("{userName}")) {
          rankupMessage = storedMsg;
        }

        rankupMessage = rankupMessage
          .replace(/{userName}/g, userName)
          .replace(/{level}/g, currentLevel)
          .replace(/{@name}/g, `@${userName}`);

        try {
          const canvasUrl = `https://betadash-api-swordslush-production.up.railway.app/api/rankup-v2?uid=${senderID}`;
          const resp = await axios.get(canvasUrl, { responseType: 'arraybuffer', timeout: 30000 });
          const { Readable } = require("stream");
          const stream = Readable.from(Buffer.from(resp.data));
          stream.path = "rankup.png";
          await message.send({
            body: rankupMessage,
            attachment: stream,
            mentions: [{ tag: userName, id: senderID }],
          });
        } catch (e) {
          console.error("[RANKUP] Canvas failed:", e.message);
          const form = {
            body: `${rankupMessage}\n⭐ **Level ${currentLevel}** — ${exp} total EXP (Rank #${leaderboardRank})`,
            mentions: [{ tag: userName, id: senderID }],
          };
          await message.send(form);
        }
      }
    } catch (e) {
      console.error("[RANKUP] Error:", e.message);
    }
  },
};
