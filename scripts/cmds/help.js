const COMMANDS_PER_PAGE = 10;

const ROLE_LABEL = {
  0: "0 (All users)",
  1: "1 (Group admins)",
  2: "2 (Bot admin)",
  3: "3 (Premium)",
  4: "4 (System admin)",
};

module.exports = {
  config: {
    name: "help",
    aliases: ["menu", "commands"],
    version: "4.9",
    author: "Vincent / John Lester",
    shortDescription: "Show all available commands",
    longDescription: "Displays a categorized list of commands or details for a specific command.",
    category: "system",
    guide: "{pn} [command | page]"
  },

  onStart: async function ({ message, args, prefix }) {
    const allCommands = global.GoatBot.commands;
    const arg = (args[0] || "").toLowerCase();

    const canonicalMods = [];
    const seen = new Set();
    for (const [, cmd] of allCommands) {
      const name = cmd.config?.name?.toLowerCase();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      canonicalMods.push(cmd);
    }
    canonicalMods.sort((a, b) => (a.config.name || "").localeCompare(b.config.name || ""));

    if (arg) {
      let cmd = allCommands.get(arg);
      if (!cmd) {
        cmd = [...allCommands.values()].find(c => (c.config.aliases || []).includes(arg));
      }
      if (!cmd) return message.reply(`❌ Command "${arg}" not found.\nUse ${prefix}help to see all commands.`);

      const cfg = cmd.config;
      const name = cfg.name || arg;
      const aliases = cfg.aliases?.length ? cfg.aliases.join(", ") : "None";
      const version = cfg.version || "N/A";
      const category = cfg.category || "Uncategorized";
      const roleNum = cfg.role ?? 0;
      const role = ROLE_LABEL[roleNum] || String(roleNum);
      const cooldown = cfg.countDown != null ? `${cfg.countDown}s` : "None";
      const desc = typeof cfg.description === "string"
        ? cfg.description
        : cfg.description?.en || cfg.shortDescription?.en || cfg.shortDescription || "No description.";
      const author = cfg.author || "Unknown";
      const rawUsage = cfg.guide || cfg.usage || "";
      const usage = typeof rawUsage === "string"
        ? rawUsage.replace(/{pn}/g, prefix)
        : rawUsage?.en?.replace(/{pn}/g, prefix) || `${prefix}${name}`;

      return message.reply(
        `『 **${name}** 』\n» ${desc}\n\n` +
        `─────────────────\n` +
        `**Category:** ${category}\n` +
        `**Aliases:** ${aliases}\n` +
        `**Usage:** \`${usage}\`\n` +
        `─────────────────\n` +
        `**Role:** ${role}\n` +
        `**Cooldown:** ${cooldown}\n` +
        `**Version:** ${version}\n` +
        `**Author:** ${author}`
      );
    }

    const categories = {};
    for (const cmd of canonicalMods) {
      const cat = (cmd.config.category || "others")
        .toLowerCase().replace(/[^\w\s-]/g, "").trim();
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd.config.name);
    }

    const sortedCats = Object.keys(categories).sort();
    const allEntries = [];
    for (const cat of sortedCats) {
      allEntries.push({ type: "header", text: cat.toUpperCase() });
      for (const cmdName of categories[cat].sort()) {
        allEntries.push({ type: "cmd", text: cmdName, cat });
      }
    }

    const totalPages = Math.max(1, Math.ceil(allEntries.length / COMMANDS_PER_PAGE));
    let page = 1;
    if (args[0] && !isNaN(args[0])) {
      page = Math.min(Math.max(1, parseInt(args[0])), totalPages);
    }

    const startIdx = (page - 1) * COMMANDS_PER_PAGE;
    const pageEntries = allEntries.slice(startIdx, startIdx + COMMANDS_PER_PAGE);

    let msg = `━━━VincentSensei━━━\n`;
    for (const entry of pageEntries) {
      if (entry.type === "header") {
        msg += `\n╭──『 ${entry.text} 』\n`;
      } else {
        msg += `× ${entry.text}\n`;
      }
    }
    msg += `╰────────────◊\n`;
    msg += `\nPage ${page}/${totalPages} · ${canonicalMods.length} commands\n`;
    msg += `➥ Use: ${prefix}help [command] for details\n`;
    msg += `➥ Use: ${prefix}help [page] to navigate`;

    return message.reply(msg);
  }
};
