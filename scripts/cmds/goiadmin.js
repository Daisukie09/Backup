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

    const adminIDs = ["61589047318104"];
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
      "Oops, admin talk detected. Let's change the subject.",
      "Admin is sleeping, don't disturb him 😴",
      "Why are you tagging my admin? Are you lost? 🤨",
      "Stop it. Get some help. 🚫",
      "My admin is too cool for you 😎",
      "I'm telling my admin you're being annoying 😒",
      "Admin says: 'Blocked.' Just kidding... unless? 👀",
      "I've been programmed to protect my admin's peace ✌️",
      "You tagged the admin. Now you face me. 🤖",
      "Admin is in a meeting. With himself. He's busy. 💼",
      "Can you not? Thanks. 🙄",
      "Bro thinks he's special tagging the admin 💀",
      "Admin left the chat. Oh wait, that's you. 😂",
      "One more tag and I'm turning off the wifi 😈",
      "That's the third time this week. We're keeping count 📋"
    ];

    api.setMessageReaction("😍", event.messageID, () => {}, true);

    return message.reply(msg[Math.floor(Math.random() * msg.length)]);
  },

  onStart: async function () {}
};
