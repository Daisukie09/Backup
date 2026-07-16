const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { getTime, drive } = global.utils;

module.exports = {
  config: {
    name: "welcome",
    version: "1.3",
    author: "John Lester",
    category: "events"
  },

  langs: {
    vi: {
      singleWelcome: "👋 Chào mừng **{userName}** đến với nhóm!",
      multiWelcome: "👋 Chào mừng đến với nhóm!\n\n{names}",
      botJoined: "✅ Kết nối thành công! Sử dụng {prefix}menu để xem lệnh.",
      dmWelcome: "👋 Chào mừng bạn đến với nhóm {threadName}! Hy vọng bạn có khoảng thời gian vui vẻ.",
      warn: "⚠️ Thành viên %1 đã bị cảnh cáo đủ 3 lần trước đó và bị ban khỏi box chat\n- Name: %1\n- Uid: %2\n- Để gỡ ban vui lòng sử dụng lệnh \"%3warn unban <uid>\"",
      needPermission: "⚠️ Bot cần quyền quản trị viên để kick thành viên bị ban"
    },
    en: {
      singleWelcome: "👋 Welcome to the group, **{userName}**!",
      multiWelcome: "👋 Welcome to the group!\n\n{names}",
      botJoined: "✅ Connected successfully! Use {prefix}menu to view commands.",
      dmWelcome: "👋 Welcome to {threadName}! Hope you enjoy your stay.",
      warn: "⚠️ Member %1 has been warned 3 times before and has been banned from the chat box\n- Name: %1\n- Uid: %2\n- To unban, please use \"%3warn unban <uid>\"",
      needPermission: "⚠️ Bot needs administrator permission to kick banned members"
    }
  },

  onStart: async ({ threadsData, message, event, api, usersData, getLang }) => {
    if (event.logMessageType == "log:subscribe")
      return async function () {
        const { threadID } = event;
        const threadData = await threadsData.get(threadID);
        if (threadData.settings.sendWelcomeMessage === false) return;

        const added = event.logMessageData.addedParticipants;
        if (!added || added.length === 0) return;

        const botID = api.getCurrentUserID();
        const botSelf = added.find(p => p.userFbId == botID);
        const { config } = global.GoatBot;
        const prefix = global.utils.getPrefix(threadID) || (config && config.PREFIX) || "/";
        const botName = (config && config.BOTNAME) || "Goat Bot";

        // ---- SPECIAL ACTION 1: Bot joined ----
        if (botSelf) {
          try { api.changeNickname(`[ ${prefix} ] ${botName}`, threadID, botID); } catch {}
          return message.send(getLang("botJoined").replace("{prefix}", prefix));
        }

        const others = added.filter(p => p.userFbId != botID);
        if (others.length === 0) return;

        const getName = (p) => p.fullName || p.firstName || `User ${p.userFbId}`;
        const firstJoiner = others[0];
        const uid = firstJoiner.userFbId;
        const userName = getName(firstJoiner);
        const threadName = threadData.threadName;
        const memberCount = threadData.members.length;

        // ---- SPECIAL ACTION 2: Welcome text ----
        let textMessage;
        if (others.length === 1) {
          textMessage = getLang("singleWelcome").replace("{userName}", userName);
        } else {
          const names = others.map(p => `• **${getName(p)}**`).join("\n");
          textMessage = getLang("multiWelcome").replace("{names}", names);
        }

        const form = { body: textMessage };

        // ---- SPECIAL ACTION 3: Canvas welcome image ----
        try {
          const canvasUrl = `https://betadash-api-swordslush-production.up.railway.app/welcome?name=${encodeURIComponent(userName)}&userid=${uid}&threadname=${encodeURIComponent(threadName || "Group")}&members=${memberCount}`;
          const response = await axios.get(canvasUrl, { responseType: 'arraybuffer', timeout: 30000 });
          const imgPath = path.join(__dirname, 'cache', `welcome_${uid}.png`);
          fs.mkdirSync(path.dirname(imgPath), { recursive: true });
          fs.writeFileSync(imgPath, Buffer.from(response.data));
          form.attachment = fs.createReadStream(imgPath);
          setTimeout(() => fs.unlink(imgPath, () => {}), 10000);
        } catch (e) {
          console.error("[WELCOME] Canvas error:", e.message);
        }

        // ---- SPECIAL ACTION 4: Custom attachments ----
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

        // ---- SPECIAL ACTION 5: Check warn & auto-kick ----
        try {
          const { data } = threadData;
          const warnList = data.warn;
          if (warnList) {
            for (const user of others) {
              const findUser = warnList.find(w => w.userID == user.userFbId);
              if (findUser && findUser.list >= 3) {
                const n = getName(user);
                message.send({
                  body: getLang("warn", n, user.userFbId, prefix),
                  mentions: [{ tag: n, id: user.userFbId }]
                }, function () {
                  api.removeUserFromGroup(user.userFbId, threadID, (err) => {
                    if (err) message.send(getLang("needPermission"));
                  });
                });
              }
            }
          }
        } catch (e) {
          console.error("[WELCOME] Check warn error:", e.message);
        }

        // ---- SPECIAL ACTION 6: Send private DM to new member ----
        try {
          for (const user of others) {
            const n = getName(user);
            api.sendMessage(
              getLang("dmWelcome").replace("{threadName}", threadName || "the group"),
              user.userFbId
            );
          }
        } catch (e) {
          console.error("[WELCOME] DM error:", e.message);
        }

        // ---- SPECIAL ACTION 7: Log join to admins ----
        try {
          const time = getTime("DD/MM/YYYY HH:mm:ss");
          const adminIDs = global.GoatBot.config.adminBot || [];
          const names = others.map(p => `${getName(p)} (${p.userFbId})`).join(", ");
          const logMsg = `👋 **New member joined**\n- Users: ${names}\n- Group: ${threadName || "Unnamed"} (${threadID})\n- Members: ${memberCount}\n- Time: ${time}`;
          for (const adminID of adminIDs) {
            api.sendMessage(logMsg, adminID);
          }
        } catch (e) {
          console.error("[WELCOME] Admin log error:", e.message);
        }
      };
  }
};
