const axios = require("axios");
const sharp = require("sharp");

const DELTA_NEXT = 5;

function expToLevel(exp) {
  if (exp <= 0) return 0;
  return Math.floor((1 + Math.sqrt(1 + (8 * exp) / DELTA_NEXT)) / 2);
}

function levelToExp(level) {
  if (level <= 0) return 0;
  return Math.floor(((level * level - level) * DELTA_NEXT) / 2);
}

async function createRankupCard(avatarUrl, name, level, rank, totalExp) {
  const cardW = 800, cardH = 400;
  const avatarSize = 130;

  let avatarBuf = null;
  if (avatarUrl && (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://"))) {
    try {
      const resp = await axios.get(avatarUrl, { responseType: "arraybuffer", timeout: 15000 });
      avatarBuf = Buffer.from(resp.data);
    } catch {}
  }

  const bgSvg = Buffer.from(
    `<svg width="${cardW}" height="${cardH}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff6b6b"/>
          <stop offset="50%" stop-color="#ee5a24"/>
          <stop offset="100%" stop-color="#f0932b"/>
        </linearGradient>
        <linearGradient id="header" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.15)"/>
          <stop offset="50%" stop-color="rgba(255,255,255,0.25)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.15)"/>
        </linearGradient>
      </defs>
      <rect width="${cardW}" height="${cardH}" fill="url(#bg)" rx="24"/>
      <rect x="10" y="10" width="${cardW - 20}" height="60" fill="url(#header)" rx="16"/>
      <path d="M 0 60 Q ${cardW / 4} 90 ${cardW / 2} 60 T ${cardW} 60 L ${cardW} 0 L 0 0 Z" fill="rgba(255,255,255,0.05)"/>
      <path d="M 0 70 Q ${cardW / 2} 30 ${cardW} 70" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
      <circle cx="50" cy="${cardH - 50}" r="30" fill="rgba(255,255,255,0.05)"/>
      <circle cx="${cardW - 40}" cy="50" r="20" fill="rgba(255,255,255,0.08)"/>
      <circle cx="${cardW - 30}" cy="40" r="8" fill="rgba(255,255,255,0.15)"/>
      <circle cx="30" cy="30" r="5" fill="rgba(255,255,255,0.2)"/>
    </svg>`
  );

  let composite = [];

  if (avatarBuf) {
    const circleMask = Buffer.from(
      `<svg width="${avatarSize}" height="${avatarSize}"><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="white"/></svg>`
    );
    const avatarCirc = await sharp(avatarBuf)
      .resize(avatarSize, avatarSize, { fit: 'cover' })
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    const borderRing = Buffer.from(
      `<svg width="${avatarSize + 10}" height="${avatarSize + 10}">
        <circle cx="${(avatarSize + 10) / 2}" cy="${(avatarSize + 10) / 2}" r="${avatarSize / 2 + 3}" fill="none" stroke="#fff" stroke-width="4"/>
        <circle cx="${(avatarSize + 10) / 2}" cy="${(avatarSize + 10) / 2}" r="${avatarSize / 2 + 5}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      </svg>`
    );

    composite.push(
      { input: avatarCirc, top: 75, left: 45 },
      { input: borderRing, top: 71, left: 41 }
    );
  }

  const textSvg = Buffer.from(
    `<svg width="${cardW}" height="${cardH}">
      <text x="${cardW / 2}" y="48" font-family="'Trebuchet MS', Arial, sans-serif" font-size="26" fill="#fff" font-weight="bold" text-anchor="middle" letter-spacing="3">⚡ LEVEL UP! ⚡</text>
      <text x="205" y="130" font-family="'Trebuchet MS', Arial, sans-serif" font-size="32" fill="#fff" font-weight="bold">${escapeXml(name)}</text>
      <text x="205" y="245" font-family="'Trebuchet MS', Arial, sans-serif" font-size="80" fill="#fff" font-weight="bold">${level}</text>
      <text x="295" y="200" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.7)">LV</text>
      <rect x="190" y="275" width="240" height="50" rx="12" fill="rgba(0,0,0,0.2)"/>
      <text x="205" y="307" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.9)">Rank ${rank}</text>
      <text x="310" y="307" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.9)">EXP ${totalExp}</text>
      <line x1="295" y1="276" x2="295" y2="324" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    </svg>`
  );

  composite.push({ input: textSvg, top: 0, left: 0 });

  return sharp(bgSvg).composite(composite).png().toBuffer();
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
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
        const cardBuf = await createRankupCard(avatarUrl, userName, level || 1, `#${leaderboardRank}`, exp);
        const { Readable } = require("stream");
        const stream = Readable.from(cardBuf);
        stream.path = "rankup.png";
        return message.send({
          body: `${getLang("checkTitle")}\n${getLang("levelup").replace(/{userName}/g, userName).replace(/{level}/g, level || 1)}`,
          attachment: stream,
          mentions: [{ tag: userName, id: senderID }],
        });
      } catch (e) {
        console.error("[RANKUP] Card generation failed:", e.message);
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
          const cardBuf = await createRankupCard(avatarUrl, userName, currentLevel, `#${leaderboardRank}`, exp);
          const { Readable } = require("stream");
          const stream = Readable.from(cardBuf);
          stream.path = "rankup.png";
          await message.send({
            body: rankupMessage,
            attachment: stream,
            mentions: [{ tag: userName, id: senderID }],
          });
        } catch (e) {
          console.error("[RANKUP] Card generation failed:", e.message);
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
