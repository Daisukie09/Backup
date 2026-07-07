const activeGiveaways = new Map();

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return num * (multipliers[unit] || 0);
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h ${min}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function pickWinners(entries, count) {
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

module.exports = {
  config: {
    name: "giveaway",
    aliases: ["ga"],
    version: "1.0.0",
    role: 2,
    author: "VincentSensei",
    description: "Create and manage giveaways in the group.",
    category: "fun",
    usage: "create <prize> <duration> [winners]\nExample: !giveaway create Free Nitro 10m 2",
    countDown: 5,
  },

  onStart: async function ({ api, message, event, args, commandName }) {
    const sub = (args[0] || "").toLowerCase();

    if (sub === "create") {
      const prize = args.slice(1).filter(a => !a.match(/^\d+[smhd]$/) && !a.match(/^\d+$/)).join(" ");
      const durationStr = args.find(a => a.match(/^\d+[smhd]$/));
      const winnersCount = parseInt(args.find(a => a.match(/^\d+$/) && a !== args.find(x => x.match(/^\d+[smhd]$/)))) || 1;

      if (!prize || !durationStr) {
        return message.reply(
          "Usage: `giveaway create <prize> <duration> [winners]`\n" +
          "Example: `giveaway create Free Nitro 10m 2`\n" +
          "Durations: s (seconds), m (minutes), h (hours), d (days)"
        );
      }

      const durationMs = parseDuration(durationStr);
      if (!durationMs) return message.reply("❌ Invalid duration. Use format like: 10m, 1h, 1d");

      const endTime = Date.now() + durationMs;
      const endFormatted = new Date(endTime).toLocaleString();

      const msg = await message.reply(
        `🎉 **GIVEAWAY** 🎉\n\n` +
        `**Prize:** ${prize}\n` +
        `**Winners:** ${winnersCount}\n` +
        `**Duration:** ${formatDuration(durationMs)}\n` +
        `**Ends:** ${endFormatted}\n\n` +
        `Reply to this message with "join" to enter!`
      );

      const giveawayId = msg.messageID;
      const giveawayData = {
        id: giveawayId,
        threadID: event.threadID,
        prize,
        winnersCount,
        endTime,
        entries: [],
        ended: false,
        timeout: setTimeout(async () => {
          const data = activeGiveaways.get(giveawayId);
          if (!data || data.ended) return;
          data.ended = true;

          const winners = pickWinners(data.entries, data.winnersCount);

          if (winners.length === 0) {
            api.sendMessage(
              `🎉 **Giveaway Ended** 🎉\n\n**Prize:** ${data.prize}\n\nNo one entered the giveaway.`,
              data.threadID
            );
          } else {
            const winnerMentions = winners.map(id => ({
              id,
              tag: (global.db.allUserData.find(u => u.userID == id)?.name || `User ${id}`)
            }));

            api.sendMessage(
              {
                body: `🎉 **Giveaway Ended** 🎉\n\n**Prize:** ${data.prize}\n**Winner(s):** ${winnerMentions.map(w => w.tag).join(", ")}\n\nCongratulations! 🎊`,
                mentions: winnerMentions
              },
              data.threadID
            );
          }

          activeGiveaways.delete(giveawayId);
        }, durationMs)
      };

      activeGiveaways.set(giveawayId, giveawayData);

      global.GoatBot.onReply.set(msg.messageID, {
        commandName,
        messageID: msg.messageID,
        author: event.senderID,
        giveawayId
      });

      return;
    }

    if (sub === "end") {
      const replyMsg = event.messageReply;
      if (!replyMsg || !activeGiveaways.has(replyMsg.messageID)) {
        return message.reply("❌ Reply to an active giveaway message to end it early.");
      }
      const data = activeGiveaways.get(replyMsg.messageID);
      if (data.ended) return message.reply("❌ This giveaway has already ended.");
      clearTimeout(data.timeout);

      const winners = pickWinners(data.entries, data.winnersCount);
      data.ended = true;

      if (winners.length === 0) {
        api.sendMessage(
          `🎉 **Giveaway Ended Early** 🎉\n\n**Prize:** ${data.prize}\n\nNo one entered the giveaway.`,
          data.threadID
        );
      } else {
        const winnerMentions = winners.map(id => ({
          id,
          tag: (global.db.allThreadData.find(t => t.threadID == data.threadID)?.members?.find(m => m.userID == id)?.name || `User ${id}`)
        }));

        api.sendMessage(
          {
            body: `🎉 **Giveaway Ended Early** 🎉\n\n**Prize:** ${data.prize}\n**Winner(s):** ${winnerMentions.map(w => w.tag).join(", ")}\n\nCongratulations! 🎊`,
            mentions: winnerMentions
          },
          data.threadID
        );
      }

      activeGiveaways.delete(replyMsg.messageID);
      return message.reply("✅ Giveaway ended.");
    }

    if (sub === "reroll") {
      const replyMsg = event.messageReply;
      if (!replyMsg) return message.reply("❌ Reply to a ended giveaway message to reroll.");
      const data = activeGiveaways.get(replyMsg.messageID);
      if (!data || !data.ended) return message.reply("❌ That giveaway has not ended yet or doesn't exist.");

      if (data.entries.length === 0) return message.reply("❌ No entries to reroll.");

      const winners = pickWinners(data.entries, data.winnersCount);
      const winnerMentions = winners.map(id => ({
        id,
        tag: (global.db.allThreadData.find(t => t.threadID == data.threadID)?.members?.find(m => m.userID == id)?.name || `User ${id}`)
      }));

      return api.sendMessage(
        {
          body: `🔄 **Reroll** 🔄\n\n**Prize:** ${data.prize}\n**New Winner(s):** ${winnerMentions.map(w => w.tag).join(", ")}\n\nCongratulations! 🎊`,
          mentions: winnerMentions
        },
        data.threadID
      );
    }

    return message.reply(
      "**Giveaway Commands:**\n" +
      "`giveaway create <prize> <duration> [winners]` — Create a giveaway\n" +
      "`giveaway end` — End a giveaway early (reply to giveaway msg)\n" +
      "`giveaway reroll` — Reroll winners (reply to ended giveaway msg)"
    );
  },

  onReply: async function ({ api, event, Reply, message }) {
    const data = activeGiveaways.get(Reply.giveawayId);
    if (!data || data.ended) return;

    const body = (event.body || "").trim().toLowerCase();
    if (body !== "join") return;

    if (event.senderID == Reply.author) {
      return message.reply("❌ You cannot join your own giveaway.");
    }

    if (data.entries.includes(event.senderID)) {
      return api.sendMessage("❌ You already joined this giveaway.", event.threadID, event.messageID);
    }

    data.entries.push(event.senderID);
    api.setMessageReaction("✅", event.messageID, () => {}, true);
  }
};
