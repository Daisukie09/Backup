const axios = require("axios");
const { Readable } = require("stream");
const { getTime, drive } = global.utils;

const GOODBYE_GIF_URL = "https://images2.imgbox.com/47/29/b72csY6y_o.gif";
let cachedGifBuffer = null;

async function getGifBuffer() {
	if (cachedGifBuffer) return cachedGifBuffer;
	const response = await axios.get(GOODBYE_GIF_URL, { responseType: "arraybuffer", timeout: 30000 });
	cachedGifBuffer = Buffer.from(response.data);
	console.log("[LEAVE] GIF cached successfully");
	return cachedGifBuffer;
}

getGifBuffer().catch(e => console.error("[LEAVE] Failed to pre-cache GIF:", e.message));

module.exports = {
	config: {
		name: "leave",
		version: "1.4",
		author: "NTKhang",
		category: "events"
	},

	langs: {
		vi: {
			session1: "sáng",
			session2: "trưa",
			session3: "chiều",
			session4: "tối",
			leaveType1: "tự rời",
			leaveType2: "bị kick",
			defaultLeaveMessage: "{userName} đã {type} khỏi nhóm"
		},
		en: {
			session1: "morning",
			session2: "noon",
			session3: "afternoon",
			session4: "evening",
			leaveType1: "left",
			leaveType2: "was kicked from",
			defaultLeaveMessage: "{userName} {type} the group"
		}
	},

	onStart: async ({ threadsData, message, event, api, usersData, getLang }) => {
		if (event.logMessageType == "log:unsubscribe")
			return async function () {
				const { threadID } = event;
				const threadData = await threadsData.get(threadID);
				if (threadData.settings.sendLeaveMessage === false)
					return;
				const { leftParticipantFbId } = event.logMessageData;
				if (leftParticipantFbId == api.getCurrentUserID())
					return;
				const hours = getTime("HH");

				const threadName = threadData.threadName;
				const userName = await usersData.getName(leftParticipantFbId);

				let { leaveMessage = getLang("defaultLeaveMessage") } = threadData.data;
				const form = {
					mentions: leaveMessage.match(/\{userNameTag\}/g) ? [{
						tag: userName,
						id: leftParticipantFbId
					}] : null
				};

				leaveMessage = leaveMessage
					.replace(/\{userName\}|\{userNameTag\}/g, userName)
					.replace(/\{type\}/g, leftParticipantFbId == event.author ? getLang("leaveType1") : getLang("leaveType2"))
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

				form.body = leaveMessage;

				if (leaveMessage.includes("{userNameTag}")) {
					form.mentions = [{
						id: leftParticipantFbId,
						tag: userName
					}];
				}

				try {
					const buf = await getGifBuffer();
					const stream = Readable.from(buf);
					stream.path = "goodbye.gif";
					form.attachment = stream;
				} catch (e) {
					console.error("[LEAVE] Failed to fetch GIF:", e.message);
				}

				if (threadData.data.leaveAttachment) {
					const files = threadData.data.leaveAttachment;
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
