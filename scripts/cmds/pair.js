const axios = require("axios");

const DELETED_NAMES = new Set([
  "facebook user",
  "deleted account",
  "unknown user",
  "ghost",
]);

function computeCompatibility(idA, idB) {
  const seed = [idA, idB].sort().join(":");
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (((hash << 5) + hash) ^ seed.charCodeAt(i)) >>> 0;
  }
  return 74 + (hash % 26);
}

function heartEmoji(score) {
  if (score >= 95) return "💖";
  if (score >= 88) return "💗";
  if (score >= 80) return "💛";
  return "💙";
}

function compatLabel(score) {
  if (score >= 95) return "A match made in heaven! 🌟";
  if (score >= 88) return "Practically soulmates 💫";
  if (score >= 80) return "Really great together!";
  return "There's definitely something there ✨";
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  config: {
    name: "pair",
    aliases: ["ship"],
    version: "2.1.0",
    role: 0,
    author: "AjiroDesu",
    description: "Pair two users and reveal their compatibility.",
    category: "fun",
    usage: "@user1 @user2 | (reply) | @mention | <uid> | me | (none)",
    countDown: 60,
  },

  onStart: async function ({ api, message, event, usersData, args }) {
    if (!event.isGroup) {
      return message.reply("❌ This command can only be used in group chats.");
    }

    const senderID = event.senderID;
    const threadID = event.threadID;
    const mentions = event.mentions || {};
    const mentionIDs = Object.keys(mentions);
    const messageReply = event.messageReply;

    let userID1, userID2;
    let genderFilterWarning = false;
    const participantIDs = event.participantIDs || [];

    try {
      if (mentionIDs.length >= 2) {
        userID1 = mentionIDs[0];
        userID2 = mentionIDs[1];
      } else if (messageReply) {
        userID1 = senderID;
        userID2 = messageReply.senderID;
      } else if (mentionIDs.length === 1) {
        userID1 = senderID;
        userID2 = mentionIDs[0];
      } else if (args[0] && args[0].toLowerCase() !== "me") {
        userID1 = senderID;
        userID2 = args[0].trim();
      } else if (args[0]?.toLowerCase() === "me") {
        const info = await api.getUserInfo(senderID);
        const senderGender = info[senderID]?.gender;
        const opposite = senderGender === 2 ? 1 : senderGender === 1 ? 2 : 0;

        const candidates = shuffle(
          (participantIDs || []).filter(id => id !== senderID)
        ).slice(0, 50);

        if (candidates.length === 0) {
          return message.reply("❌ No other participants found to pair you with.");
        }

        const profiles = await Promise.all(
          candidates.map(async id => {
            try {
              const i = await api.getUserInfo(id);
              const raw = i[id] || {};
              const nameLower = (raw.name || "").toLowerCase().trim();
              return {
                id,
                name: raw.name || `User ${id}`,
                gender: raw.gender,
                isDeleted: DELETED_NAMES.has(nameLower),
              };
            } catch {
              return { id, name: `User ${id}`, gender: 0, isDeleted: false };
            }
          })
        );

        const valid = profiles.filter(p => !p.isDeleted);
        if (valid.length === 0) {
          return message.reply("❌ No eligible participants found to pair you with.");
        }

        const gendered = opposite !== 0
          ? valid.filter(p => p.gender === opposite)
          : [];

        if (gendered.length === 0) genderFilterWarning = true;
        const partner = pickOne(gendered) || pickOne(valid);
        if (!partner) {
          return message.reply("❌ No eligible participants found to pair you with.");
        }

        userID1 = senderID;
        userID2 = partner.id;
      } else {
        const candidates = shuffle(
          (participantIDs || []).filter(id => id !== senderID)
        ).slice(0, 50);

        if (candidates.length < 2) {
          return message.reply("❌ Not enough participants found. Try mentioning someone.");
        }

        const profiles = await Promise.all(
          candidates.map(async id => {
            try {
              const i = await api.getUserInfo(id);
              const raw = i[id] || {};
              const nameLower = (raw.name || "").toLowerCase().trim();
              return {
                id,
                name: raw.name || `User ${id}`,
                gender: raw.gender,
                isDeleted: DELETED_NAMES.has(nameLower),
              };
            } catch {
              return { id, name: `User ${id}`, gender: 0, isDeleted: false };
            }
          })
        );

        const valid = profiles.filter(p => !p.isDeleted);
        if (valid.length < 2) {
          return message.reply("❌ Not enough eligible participants found.");
        }

        const males = valid.filter(p => p.gender === 2);
        const females = valid.filter(p => p.gender === 1);
        let picked1, picked2;

        if (males.length > 0 && females.length > 0) {
          picked1 = pickOne(males);
          picked2 = pickOne(females);
        } else {
          genderFilterWarning = true;
          const shuffled = shuffle(valid);
          picked1 = shuffled[0];
          picked2 = shuffled[1];
        }

        if (!picked1 || !picked2) {
          return message.reply("❌ Not enough eligible participants found.");
        }

        if (Math.random() < 0.5) {
          userID1 = picked1.id;
          userID2 = picked2.id;
        } else {
          userID1 = picked2.id;
          userID2 = picked1.id;
        }
      }

      if (userID1 === userID2) {
        return message.reply("❌ You cannot pair a user with themselves.");
      }

      const [info1, info2] = await Promise.all([
        api.getUserInfo(userID1),
        api.getUserInfo(userID2),
      ]);

      const name1 = info1[userID1]?.name || userID1;
      const name2 = info2[userID2]?.name || userID2;

      const compatibility = computeCompatibility(userID1, userID2);

      let caption = `${heartEmoji(compatibility)} **${name1}** x **${name2}**\n`;
      caption += `Compatibility: **${compatibility}%** — ${compatLabel(compatibility)}`;
      if (genderFilterWarning) {
        caption += "\n_Note: gender info was unavailable, so the pair was chosen at random._";
      }

      await message.reply(caption);
    } catch (err) {
      message.reply(`⚠️ **Error:** ${err.message || "Something went wrong."}`);
    }
  },
};
