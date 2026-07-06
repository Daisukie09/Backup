const DELTA_NEXT = 5;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

function expToLevel(exp) {
  if (exp <= 0) return 0;
  return Math.floor((1 + Math.sqrt(1 + (8 * exp) / DELTA_NEXT)) / 2);
}

function parseLimit(raw) {
  if (raw === undefined) return DEFAULT_LIMIT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function formatMoney(amount) {
  if (amount === Infinity) return "∞";
  return amount.toLocaleString("en-US");
}

function position(i) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `${i + 1}.`;
}

module.exports = {
  config: {
    name: "top",
    aliases: ["leaderboard", "lb"],
    version: "1.0.0",
    role: 0,
    author: "John Lester",
    description: "View top users by coin balance or EXP level.",
    category: "economy",
    usage: "money [limit] | level [limit]",
    countDown: 5,
  },

  onStart: async function ({ message, usersData, event, args }) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      return message.reply(
        "**Usage:**\n" +
        `\`top money [limit]\` — top richest users\n` +
        `\`top level [limit]\` — top highest level users\n` +
        `Limit defaults to ${DEFAULT_LIMIT}, max ${MAX_LIMIT}.`
      );
    }

    const limit = parseLimit(args[1]);

    if (sub === "money") {
      const allUsers = await usersData.getAll();
      const ranked = allUsers
        .map(u => ({ id: u.userID, money: u.money || 0 }))
        .filter(u => u.money > 0)
        .sort((a, b) => b.money - a.money)
        .slice(0, limit);

      const lines = [`💰 **Top ${ranked.length} Richest Users**`];
      for (let i = 0; i < ranked.length; i++) {
        const name = await usersData.getName(ranked[i].id) || "Unknown";
        lines.push(`${position(i)} **${name}** — ${formatMoney(ranked[i].money)} coins`);
      }
      if (ranked.length === 0) lines.push("No users have earned coins yet.");
      return message.reply(lines.join("\n"));
    }

    if (sub === "level" || sub === "rank") {
      const allUsers = await usersData.getAll();
      const ranked = allUsers
        .map(u => ({ id: u.userID, exp: u?.data?.exp || 0 }))
        .filter(u => u.exp > 0)
        .sort((a, b) => b.exp - a.exp)
        .slice(0, limit);

      const lines = [`🏆 **Top ${ranked.length} Highest Level Users**`];
      for (let i = 0; i < ranked.length; i++) {
        const name = await usersData.getName(ranked[i].id) || "Unknown";
        const level = expToLevel(ranked[i].exp);
        lines.push(`${position(i)} **${name}** — Level ${level} (${ranked[i].exp.toLocaleString()} EXP)`);
      }
      if (ranked.length === 0) lines.push("No users have gained EXP yet.");
      return message.reply(lines.join("\n"));
    }

    return message.reply(
      `❌ Unknown leaderboard type: \`${sub}\`\n\n` +
      "**Usage:**\n" +
      `\`top money [limit]\` — top richest users\n` +
      `\`top level [limit]\` — top highest level users`
    );
  },
};
