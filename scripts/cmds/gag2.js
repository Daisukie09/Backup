const axios = require('axios');
const moment = require('moment-timezone');

const GAG2_STOCK_API = 'https://api.growagarden2stock.com';
const GAG2_WEATHER_API = 'https://www.game.guide/api/gag2-stock';
const TZ = 'Asia/Manila';
const POLL_INTERVAL = 30000;

const BEST_SEEDS = [
	'Venus Fly Trap', 'Poison Apple', 'Venom Spitter',
	'Pomegranate', 'Moon Bloom', 'Hypno Bloom', "Dragon's Breath"
];

const BEST_SEEDS_DISPLAY = [
	'Venus Fly Trap', 'Poison Apple', 'Venus Splitter',
	'Pomegranate', 'Moon Bloom', 'Hypno Bloom', "Dragon's Breath"
];

const BEST_GEARS = [
	'Strawberry Sniper', 'Legendary Sprinkler',
	'Super Watering Can', 'Super Sprinkler'
];

const ITEM_EMOJI = {
	'Carrot': '🥕', 'Strawberry': '🍓', 'Blueberry': '🫐',
	'Tulip': '🌷', 'Tomato': '🍅', 'Apple': '🍎',
	'Bamboo': '🎋', 'Mushroom': '🍄', 'Green Bean': '🫛',
	'Coconut': '🥥', 'Pineapple': '🍍', 'Banana': '🍌',
	'Cactus': '🌵', 'Corn': '🌽', 'Grape': '🍇',
	'Mango': '🥭', 'Cherry': '🍒', 'Sunflower': '🌻',
	'Acorn': '🌰', 'Pumpkin': '🎃',
	'Venus Fly Trap': '🪰', 'Poison Apple': '☣️',
	'Venom Spitter': '🫟', 'Venus Splitter': '🫟', 'Pomegranate': '🌋',
	'Moon Bloom': '🌙', 'Hypno Bloom': '🌀',
	"Dragon's Breath": '🐲', 'Dr/agon Fruit': '🐉',
	'Beanstalk': '🌿', 'Thorn Rose': '🌹', 'Ghost Pepper': '👻',
	'Baby Cactus': '🌵', 'Romanesco': '🥦', 'Horned Melon': '🍈',
	'Pinetree': '🌲', 'Glow Mushroom': '🍄', 'Poison Ivy': '🌿',
	'Rocket Pop': '🚀',
	'Common Watering Can': '💧', 'Uncommon Sprinkler': '💦',
	'Common Sprinkler': '💦', 'Rare Sprinkler': '🔵',
	'Legendary Sprinkler': '🦿', 'Super Sprinkler': '🪖',
	'Super Watering Can': '🦸', 'Strawberry Sniper': '🍓',
	'Basic Pot': '🪴', 'Trowel': '🔧', 'Gnome': '🧑‍🌾',
	'Flashbang': '💥', 'Teleporter': '📡', 'Shovel': '⛏️',
	'Rake': '🌾', 'Power Hose': ' hose', 'Lantern': '🏮',
	'Rainbow': '🌈', 'Rainbow Carpet': '🌈', 'Vine Wrapper': '🌿',
	'Freeze Ray': '❄️', 'Door Crowbar': '🔧', 'Wheelbarrow': '🛒',
	'Speed Mushroom': '⚡', 'Jump Mushroom': '🦘',
	'Supersize Mushroom': '📏', 'Shrink Mushroom': '📐',
	'Invisibility Mushroom': '👻', 'Sign': '🪧',
	'Light Crate': '💡', 'Ladder Crate': '🪜',
	'Arch Crate': '🏛️', 'Bench Crate': '🪑',
	'Bridge Crate': '🌉', 'Fence Crate': '🚧',
	'Sign Crate': '📋', 'Spring Crate': '🪄',
	'Conveyor Crate': '⚙️', 'Bear Trap Crate': '🪤',
	'Owner Door Crate': '🚪', 'Picture Frame Crate': '🖼️',
	'Roleplay Crate': '🎭', 'Seesaw Crate': '🪢',
	'Teleporter Pad Crate': '📡', 'Fourth Of July Crate': '🎆'
};

const RARITY_ORDER = {
	common: 0, uncommon: 1, rare: 2, epic: 3,
	legendary: 4, mythic: 5, super: 6, prismatic: 7, divine: 8,
	Common: 0, Uncommon: 1, Rare: 2, Epic: 3,
	Legendary: 4, Mythic: 5, Super: 6, Prismatic: 7, Divine: 8
};

const MOON_EMOJI = {
	'Moon': '🌙', 'Goldmoon': '🌕', 'Bloodmoon': '🔴',
	'Rainbow Moon': '🌈', 'Mega Moon': '🟣'
};

let pollTimer = null;
const activeSessions = new Map();
let lastStockHash = null;

function getEmoji(name) {
	return ITEM_EMOJI[name] || '❓';
}

function capitalize(s) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(unix) {
	return moment.unix(unix).tz(TZ).format('hh:mm A');
}

function formatDate(unix) {
	return moment.unix(unix).tz(TZ).format('M/D/YYYY, h:mm:ss A');
}

function formatCountdown(secs) {
	if (secs <= 0) return '0s';
	const h = Math.floor(secs / 3600);
	const m = Math.floor((secs % 3600) / 60);
	const s = secs % 60;
	let parts = [];
	if (h > 0) parts.push(`${h}h`);
	if (m > 0) parts.push(`${m}m`);
	parts.push(`${s}s`);
	return parts.join(' ');
}

function formatCountdownShort(secs) {
	if (secs <= 0) return '0:00';
	const m = Math.floor(secs / 60);
	const s = secs % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function raritySort(a, b) {
	const ra = (a.rarity || 'common').toLowerCase();
	const rb = (b.rarity || 'common').toLowerCase();
	return (RARITY_ORDER[rb] || 0) - (RARITY_ORDER[ra] || 0);
}

async function fetchStockCategory(category) {
	try {
		const res = await axios.get(`${GAG2_STOCK_API}/stock?category=${category}`, { timeout: 15000 });
		if (!res.data.success) return [];
		return (res.data.items || []).filter(i => i.in_stock === 1 || i.in_stock === true);
	} catch (e) {
		console.error(`[GAG2M] Stock fetch failed for ${category}:`, e.message);
		return [];
	}
}

async function fetchAllStock() {
	const [seeds, gear, crates] = await Promise.all([
		fetchStockCategory('seeds'),
		fetchStockCategory('gear'),
		fetchStockCategory('crates')
	]);
	return { seeds, gear, crates };
}

async function fetchWeatherData() {
	try {
		const res = await axios.get(GAG2_WEATHER_API, { timeout: 15000 });
		return res.data;
	} catch (e) {
		console.error('[GAG2M] Weather fetch failed:', e.message);
		return null;
	}
}

function getCurrentPhase(data, now) {
	const clen = data.weather.clen;
	const phases = data.weather.phases;
	const seq = data.weather.seq;
	const startCycle = data.weather.startCycle;

	const cycleIndex = Math.floor(now / clen);
	const cyclePos = now % clen;
	const seqIdx = ((cycleIndex - startCycle) % seq.length + seq.length) % seq.length;
	const seqEntry = seq[seqIdx];

	let currentPhase = 'Day';
	let remaining = 0;
	for (const ph of phases) {
		const start = ph.offset;
		const end = ph.offset + ph.duration;
		if (cyclePos >= start && cyclePos < end) {
			currentPhase = ph.name;
			remaining = end - cyclePos;
			break;
		}
	}

	const moonName = seqEntry ? seqEntry[2] : 'Moon';
	const moonEmoji = MOON_EMOJI[moonName] || '🌙';

	return { currentPhase, moonName, moonEmoji, remaining, cycleIndex, seq, startCycle, clen, phases };
}

function buildCombinedMessage(stock, weatherData, participantIDs) {
	const now = Math.floor(Date.now() / 1000);
	const lines = [];

	lines.push('🌱 SEED SHOP STOCK');
	if (stock.seeds.length === 0) {
		lines.push('  No seeds in stock');
	} else {
		const sorted = [...stock.seeds].sort(raritySort);
		for (const item of sorted) {
			const emoji = getEmoji(item.item_name);
			lines.push(`  ${emoji} ${item.item_name}: x${item.quantity}`);
		}
	}

	lines.push('');
	lines.push('⚙️ GEAR SHOP STOCK');
	if (stock.gear.length === 0) {
		lines.push('  No gear in stock');
	} else {
		const sorted = [...stock.gear].sort(raritySort);
		for (const item of sorted) {
			const emoji = getEmoji(item.item_name);
			lines.push(`  ${emoji} ${item.item_name}: x${item.quantity}`);
		}
	}

	lines.push('');
	lines.push('📦 CRATE SHOP STOCK');
	if (stock.crates.length === 0) {
		lines.push('  No crates in stock');
	} else {
		const sorted = [...stock.crates].sort(raritySort);
		for (const item of sorted) {
			const emoji = getEmoji(item.item_name);
			lines.push(`  ${emoji} ${item.item_name}: x${item.quantity}`);
		}
	}

	const bestSeed = stock.seeds.find(s => BEST_SEEDS.includes(s.item_name));
	const bestGear = stock.gear.find(g => BEST_GEARS.includes(g.item_name));

	if (bestSeed && bestGear) {
		const bsEmoji = getEmoji(bestSeed.item_name);
		const bgEmoji = getEmoji(bestGear.item_name);
		lines.push('');
		lines.push(`@everyone on stock ${bestSeed.quantity}x ${bsEmoji} ${bestSeed.item_name} and ${bestGear.quantity}x ${bgEmoji} ${bestGear.item_name}`);
		lines.push('Because even the not good seeds get mixed in with the stock. Best seed and gear 👇');
		lines.push('');
		lines.push('{Seed}');
		for (const s of BEST_SEEDS_DISPLAY) {
			const e = getEmoji(s);
			lines.push(`${e}${s}`);
		}
		lines.push('');
		lines.push('{Gear}');
		for (const g of BEST_GEARS) {
			const e = getEmoji(g);
			lines.push(`${e}${g}`);
		}
	}

	if (weatherData) {
		const phase = getCurrentPhase(weatherData, now);

		lines.push('');
		lines.push('☀️ DAY & NIGHT');
		lines.push(`Right now: ${phase.currentPhase}`);
		lines.push(`${phase.currentPhase} ends in ${formatCountdownShort(phase.remaining)}`);

		const upcomingMoons = [];
		const cycleLen = phase.clen;
		const nightOffset = 480;

		for (let i = 0; i < 25; i++) {
			const cycleIdx = phase.cycleIndex + i;
			const seqIdx = ((cycleIdx - phase.startCycle) % phase.seq.length + phase.seq.length) % phase.seq.length;
			const moonName = phase.seq[seqIdx][2];
			const nightStart = cycleIdx * cycleLen + nightOffset;
			const secsUntilMoon = nightStart + 30 - now;

			if (secsUntilMoon > 0) {
				const moonEmoji = MOON_EMOJI[moonName] || '🌙';
				upcomingMoons.push({
					name: moonName,
					emoji: moonEmoji,
					nightTime: nightStart,
					countdown: formatCountdown(secsUntilMoon)
				});
			}
		}

		lines.push('');
		lines.push('Upcoming nights & moons');
		for (const m of upcomingMoons.slice(0, 18)) {
			lines.push(`Night at ${formatTime(m.nightTime)} — ${m.emoji} ${m.name} in ${m.countdown}`);
		}
	}

	lines.push('');
	lines.push(`⏰ ${formatDate(now)}`);

	const body = lines.join('\n');

	const mentions = [];
	if (bestSeed && bestGear && participantIDs && participantIDs.length > 0) {
		const tag = '@everyone';
		for (const uid of participantIDs) {
			mentions.push({ tag, id: uid, fromIndex: body.indexOf(tag) });
		}
	}

	return { body, mentions, hasGoodStock: !!(bestSeed && bestGear) };
}

function stockHash(stock) {
	const parts = [];
	for (const cat of ['seeds', 'gear', 'crates']) {
		for (const i of stock[cat]) {
			parts.push(`${i.item_name}:${i.quantity}:${i.in_stock}`);
		}
	}
	return parts.join('|');
}

async function broadcastToActive(api) {
	for (const [threadID, session] of activeSessions.entries()) {
		if (!session.enabled) continue;

		try {
			const stock = await fetchAllStock();
			const hash = stockHash(stock);

			if (lastStockHash !== null && lastStockHash === hash) continue;
			lastStockHash = hash;

			const weatherData = await fetchWeatherData();
			const msg = buildCombinedMessage(stock, weatherData, session.participantIDs);
			try { api.sendMessage({ body: msg.body, mentions: msg.mentions }, threadID); } catch (e) {}
		} catch (e) {
			console.error('[GAG2M] Broadcast error:', e.message);
		}
	}
}

function startPolling(api) {
	if (pollTimer) return;
	console.log('[GAG2M] Started polling every 30s...');

	pollTimer = setInterval(() => {
		broadcastToActive(api);
	}, POLL_INTERVAL);
}

module.exports = {
	config: {
		name: "gag2",
		version: "5.0",
		author: "Vincent",
		role: 2,
		description: "GAG2 live stock + weather monitor",
		category: "stock",
		guide: "{pn} on — Start auto updates\n{pn} off — Stop\n{pn} now — Current status"
	},

	onStart: async ({ message, event, args, api }) => {
		const body = args.join(" ").toLowerCase();
		const threadID = event.threadID;

		if (body === "on") {
			activeSessions.set(threadID, {
				enabled: true,
				participantIDs: event.participantIDs
			});
			if (!pollTimer) startPolling(api);

			const stock = await fetchAllStock();
			const weatherData = await fetchWeatherData();
			const msg = buildCombinedMessage(stock, weatherData, event.participantIDs);
			message.reply({ body: msg.body, mentions: msg.mentions });
			return;
		}

		if (body === "off") {
			activeSessions.delete(threadID);
			if (activeSessions.size === 0 && pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			message.reply("✅ GAG2 monitoring disabled!");
			return;
		}

		if (body === "now" || body === "") {
			const stock = await fetchAllStock();
			const weatherData = await fetchWeatherData();
			const msg = buildCombinedMessage(stock, weatherData, event.participantIDs);
			message.reply({ body: msg.body, mentions: msg.mentions });
			return;
		}

		message.reply("❌ Commands: on, off, now");
	}
};
