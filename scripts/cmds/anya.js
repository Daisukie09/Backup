const axios = require("axios");

module.exports.config = {
	name: "anya",
	version: "1.2",
	hasPermssion: 0,
	credits: "Xemon",
	description: "Chat with Anya AI",
	commandCategory: "funny",
	usages: "on — Toggle auto-reply\n  off — Disable auto-reply\n  <text> — Quick chat",
	cooldowns: 15,
	dependencies: {
		"axios": ""
	}
};

async function getMessage(yourMessage) {
	const res = await axios.post(
		'https://torgpt.space/api/v1/chat',
		{ messages: [{ role: 'user', content: yourMessage }] },
		{ headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
	);
	const data = res.data;
	return data.choices?.[0]?.message?.content || data.response || data.message || "What?🙂";
}

module.exports.run = async function ({ api, event, args, Threads }) {
	const { threadID, messageID } = event;

	if (args[0] === 'on' || args[0] === 'off') {
		try {
			const threadData = await Threads.getData(threadID);
			const data = (threadData && threadData.data) || {};
			data.anya = args[0] === 'on';
			await Threads.setData(threadID, { data });
			const reply = args[0] === 'on' ? '✅ Turned on Anya successfully!' : '✅ Turned off Anya successfully!';
			return api.sendMessage(reply, threadID, messageID);
		} catch (e) {
			console.log('[ANYA] Toggle error:', e.message);
			return api.sendMessage('Error toggling Anya.', threadID, messageID);
		}
	}

	if (args.length > 0) {
		const yourMessage = args.join(" ");
		try {
			const responseMessage = await getMessage(yourMessage);
			return api.sendMessage(responseMessage, threadID, messageID);
		} catch (err) {
			console.log('[ANYA] API error:', err.message);
			return api.sendMessage("What?🙂", threadID, messageID);
		}
	}

	return api.sendMessage("Usage: anya on | off | <text>", threadID, messageID);
};

module.exports.handleEvent = function ({ api, event, Threads }) {
	const { threadID, messageID, senderID, body } = event;
	if (!body || senderID === api.getCurrentUserID()) return;
	if (body.startsWith('/')) return;

	Threads.getData(threadID).then(threadData => {
		const data = (threadData && threadData.data) || {};
		if (!data.anya) return;

		return getMessage(body).then(responseMessage => {
			api.sendMessage(responseMessage, threadID, messageID);
		}).catch(() => {});
	}).catch(() => {});
};
