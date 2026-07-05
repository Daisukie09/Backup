module.exports = {
  config: {
    name: "goiadmin",
    author: "?/zed",
    role: 0,
    shortDescription: "",
    longDescription: "",
    category: "love",
    guide: "{pn}"
  },

  onStart: async function ({ api, event }) {
    const adminID = "61589047318104";

    if (event.senderID === adminID) return;

    if (Object.keys(event.mentions).includes(adminID)) {
      const msg = [
        "Don't tag admin, he's busy 😗",
        "Admin is currently unavailable 🤧",
        "Sorry, admin is offline 😪",
        "Do you like my admin? That's why you're tagging him? 😏",
        "Tag my admin again and I'll punch you 🙂"
      ];

      api.setMessageReaction("😍", event.messageID, () => {}, true);

      return api.sendMessage(
        {
          body: msg[Math.floor(Math.random() * msg.length)]
        },
        event.threadID,
        event.messageID
      );
    }
  }
};
