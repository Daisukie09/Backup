module.exports = {
  config: {
    name: "goiadmin",
    author: "VincentSensei",
    role: 0,
    shortDescription: "",
    longDescription: "",
    category: "love",
    guide: "{pn}"
  },

  onChat: async function ({ message, event, api, commandName }) {
    if (!event.mentions || Object.keys(event.mentions).length === 0) return;

    const adminIDs = global.GoatBot.config.adminBot || [];
    const mentionedIds = Object.keys(event.mentions);

    if (!mentionedIds.some(id => adminIDs.includes(id))) return;
    if (adminIDs.includes(event.senderID)) return;

    const msg = [
      "Don't tag admin, he's busy 😗",
      "Admin is currently unavailable 🤧",
      "Sorry, admin is offline 😪",
      "Do you like my admin? That's why you're tagging him? 😏",
      "Tag my admin again and I'll punch you 🙂",
      "Hey, let's not bring the admins into this… they're watching.",
      "Careful. You just summoned an admin. I'd avoid that.",
      "Oops, admin talk detected. Let's change the subject."
    ];

    api.setMessageReaction("😍", event.messageID, () => {}, true);

    return message.reply(msg[Math.floor(Math.random() * msg.length)]);
  },

  onStart: async function () {}
};
