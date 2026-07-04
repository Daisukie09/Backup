const axios = require("axios");
const { Readable } = require("stream");
const { getTime, drive } = global.utils;

const WELCOME_GIF_URL = "https://thumbs2.imgbox.com/47/a3/KqMEHaNO_t.gif";
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
		version: "1.0",
		author: "NTKhang",
		category: "events"
	},

	langs: {
		vi: {
			session1: "sáng",
			session2: "trưa",
			session3: "chiều",
			session4: "tối",
			defaultWelcomeMessage: "Chào mừng {userName} đến với {boxName}!"
		},
		en: {
			session1: "morning",
			session2: "noon",
			session3: "afternoon",
			session4: "evening",
			defaultWelcomeMessage: "Welcome {userName} to {boxName}!"
		}
	},

	onStart: async ({ threadsData, message, event, api, usersData, getLang }) => {
		if (event.logMessageType == "log:subscribe")
			return async function () {
				const { threadID } = event;
				const threadData = await threadsData.get(threadID);
				if (threadData.settings.sendWelcomeMessage === false)
					return;

				const { addedParticipants } = event.logMessageData;
				if (!addedParticipants || addedParticipants.length == 0)
					return;

				const hours = getTime("HH");
				const threadName = threadData.threadName;

				for (const participant of addedParticipants) {
					if (participant.userFbId == api.getCurrentUserID())
						continue;

					const userName = participant.fullName || await usersData.getName(participant.userFbId);

					let { welcomeMessage = getLang("defaultWelcomeMessage") } = threadData.data;

					welcomeMessage = welcomeMessage
						.replace(/\{userName\}|\{userNameTag\}/g, userName)
						.replace(/\{threadName\}|\{boxName\}/g, threadName)
						.replace(/\{time\}/g, hours)
						.replace(/\{session\}/g, hours <= 10 ?
							getLang("session1") :
							hours <= 12 ?
								getLang("session2") :
								hours <= 18 ?
									getLang("session3") :
									getLang("session4")
						);

					const form = { body: welcomeMessage };

					if (welcomeMessage.includes("{userNameTag}")) {
						form.mentions = [{
							id: participant.userFbId,
							tag: userName
						}];
					}

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
				}
			};
	}
};
