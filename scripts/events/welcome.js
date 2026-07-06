const axios = require("axios");
const { Readable } = require("stream");
const { getTime, drive } = global.utils;

const WELCOME_GIF_URL = "https://files.catbox.moe/sdf7f0.gif";
let cachedGifBuffer = null;

async function getGifBuffer() {
  if (cachedGifBuffer) return cachedGifBuffer;
  const response = await axios.get(WELCOME_GIF_URL, { responseType: "arraybuffer", timeout: 30000 });
  cachedGifBuffer = Buffer.from(response.data);
  console.log("[WELCOME] GIF cached successfully");
  return cachedGifBuffer;
}

getGifBuffer().catch(e => console.error("[WELCOME] Failed to pre-cache GIF:", e.message));

module.exports = {
  config: {
    name: "welcome",
    version: "1.1",
    author: "John Lester",
    category: "events"
  },

  langs: {
    vi: {
      singleWelcome: "👋 Chào mừng **{userName}** đến với nhóm!",
      multiWelcome: "👋 Chào mừng đến với nhóm!\n\n{names}"
    },
    en: {
      singleWelcome: "👋 Welcome to the group, **{userName}**!",
      multiWelcome: "👋 Welcome to the group!\n\n{names}"
    }
  },

  onStart: async ({ threadsData, message, event, api, usersData, getLang }) => {
    if (event.logMessageType == "log:subscribe")
      return async function () {
        const { threadID } = event;
        const threadData = await threadsData.get(threadID);
        if (threadData.settings.sendWelcomeMessage === false) return;

        const logMessageData = event.logMessageData;
        const added = logMessageData.addedParticipants;
        if (!added || added.length === 0) return;

        if (added.some(p => p.userFbId == api.getCurrentUserID())) return;

        const getName = (p) => p.fullName || p.firstName || `User ${p.userFbId}`;

        let textMessage;
        if (added.length === 1) {
          textMessage = getLang("singleWelcome").replace("{userName}", getName(added[0]));
        } else {
          const names = added.map(p => `• **${getName(p)}**`).join("\n");
          textMessage = getLang("multiWelcome").replace("{names}", names);
        }

        const firstJoiner = added[0];
        const firstId = firstJoiner.userFbId;
        const userName = getName(firstJoiner);

        const threadName = threadData.threadName;
        const memberCount = threadData.members.length;

        const form = { body: textMessage };

        try {
          const buf = await getGifBuffer();
          const stream = Readable.from(buf);
          stream.path = "welcome.gif";
          form.attachment = stream;
        } catch (e) {
          console.error("[WELCOME] Failed to fetch GIF:", e.message);
        }

        if (threadData.data.welcomeAttachment) {
          const files = threadData.data.welcomeAttachment;
          const attachments = files.reduce((acc, file) => {
            acc.push(drive.getFile(file, "stream"));
            return acc;
          }, []);
          const customAttachments = (await Promise.allSettled(attachments))
            .filter(({ status }) => status == "fulfilled")
            .map(({ value }) => value);

          if (customAttachments.length > 0) {
            if (form.attachment) {
              form.attachment = [form.attachment, ...customAttachments];
            } else {
              form.attachment = customAttachments;
            }
          }
        }

        message.send(form);
      };
  }
};
