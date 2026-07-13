const PACKS = {
  bts: { name: "BTS", emoji: "💜", kw: ["bts", "bangtan", "army", "dynamite", "butter", "jungkook", "jimin", "v", "rm", "jin", "suga", "jhope"], stickers: ["456537923422653", "456540200089092", "456549833421462", "456545143421931"] },
  blackpink: { name: "BLACKPINK", emoji: "🖤", kw: ["blackpink", "blink", "jennie", "lisa", "jisoo", "rose", "howyoulikethat"], stickers: ["456540200089092", "456549833421462", "456545143421931", "456548426754932"] },
  taylorswift: { name: "Taylor Swift", emoji: "🎤", kw: ["taylor", "swift", "taylorswift", "swiftie", "shake it off", "blank space"], stickers: ["456549833421462", "456545143421931", "456547600088317", "456549090088199"] },
  kpop: { name: "K-Pop", emoji: "🎤", kw: ["kpop", "k-pop", "k pop", "korean pop"], stickers: ["456537923422653", "456540200089092", "456549833421462", "456545143421931", "456540633422378", "456542080088900", "456548426754932", "456549090088199"] },
  opm: { name: "OPM", emoji: "🎶", kw: ["opm", "original pilipino", "filipino", "pinoy", "bendian", "eheads", "eraserheads"], stickers: ["456537923422653", "456549833421462", "456545143421931", "456547600088317", "456549090088199"] },
  hiphop: { name: "Hip-Hop", emoji: "🎧", kw: ["hiphop", "hip hop", "rap", "rapper", "rnb", "r&b"], stickers: ["456540200089092", "456549833421462", "456545143421931", "456542080088900", "456548426754932"] },
  rock: { name: "Rock", emoji: "🎸", kw: ["rock", "metal", "alternative", "punk", "guitar", "band"], stickers: ["456540200089092", "456537923422653", "456549833421462", "456545143421931", "456547086755034", "456547600088317"] },
  jazz: { name: "Jazz & Blues", emoji: "🎷", kw: ["jazz", "blues", "saxophone", "piano", "swing"], stickers: ["456537923422653", "456540200089092", "456549833421462", "456545143421931", "456542080088900"] },
  edm: { name: "EDM", emoji: "🎹", kw: ["edm", "electronic", "dance", "dj", "club", "techno", "house", "remix"], stickers: ["456540200089092", "456549833421462", "456545143421931", "456540633422378", "456548426754932"] },
  reggae: { name: "Reggae", emoji: "🌴", kw: ["reggae", "ska", "reggaeton", "dancehall", "jamaica", "bob marley"], stickers: ["456537923422653", "456549833421462", "456545143421931", "456547600088317"] },
  country: { name: "Country", emoji: "🤠", kw: ["country", "western", "folk", "bluegrass", "dolly", "johnny cash"], stickers: ["456540200089092", "456537923422653", "456549833421462", "456545143421931"] },
  love: { name: "Love Songs", emoji: "💕", kw: ["love", "romantic", "heart", "sentimental", "ballad"], stickers: ["456537923422653", "456540200089092", "456549833421462", "456545143421931", "456540633422378"] },
  party: { name: "Party", emoji: "🎉", kw: ["party", "dance", "celebration", "club", "night", "vibe"], stickers: ["456540200089092", "456549833421462", "456545143421931", "456548426754932", "456547086755034"] },
  christmas: { name: "Christmas", emoji: "🎄", kw: ["christmas", "xmas", "holiday", "santa", "noel", "pasko"], stickers: ["456537923422653", "456549833421462", "456545143421931", "456540200089092"] },
  instrumental: { name: "Instrumental", emoji: "🎻", kw: ["instrumental", "piano", "guitar", "violin", "orchestra", "classical"], stickers: ["456537923422653", "456549833421462", "456545143421931", "456547086755034"] },
  opm_ballad: { name: "OPM Ballad", emoji: "🎤", kw: ["opm ballad", "filipino love", "pinoy love", "tagalog", "release"], stickers: ["456537923422653", "456549833421462", "456545143421931", "456547600088317"] },
  opm_rock: { name: "OPM Rock", emoji: "🎸", kw: ["opm rock", "pinoy rock", "filipino rock", "eraserheads", "parokya"], stickers: ["456540200089092", "456549833421462", "456545143421931", "456547086755034"] },
  reggae_opm: { name: "Reggae OPM", emoji: "🌴", kw: ["reggae opm", "pinoy reggae", "filipino reggae"], stickers: ["456537923422653", "456549833421462", "456545143421931"] },
};

module.exports = {
  config: {
    name: "play",
    version: "2.0.0",
    role: 0,
    author: "Vincent Magtolis",
    description: "Search and send music stickers by name. Supports any language.",
    category: "Music",
    usage: "<search term> — Example: play bts, play taylor, play kpop",
    countDown: 3,
  },

  onStart: async function ({ message, event, args, api }) {
    const input = args.join(" ").trim().toLowerCase();
    const threadID = event.threadID;

    if (!input || input === "list" || input === "help") {
      const cats = Object.values(PACKS).map(p => `${p.emoji} ${p.name}`).join("  ");
      return message.reply(`🎵 *Music Stickers*\nTry: \`!play <artist/genre>\`\n\nAvailable: ${cats}`);
    }

    const results = Object.entries(PACKS).filter(([key, pack]) =>
      key === input ||
      pack.name.toLowerCase() === input ||
      pack.kw?.some(k => k === input) ||
      pack.kw?.some(k => k.includes(input)) ||
      pack.name.toLowerCase().includes(input) ||
      input.includes(key)
    );

    if (results.length === 0) {
      return message.reply(`No music pack found for "${input}". Try: bts, blackpink, taylorswift, kpop, opm, hiphop, rock, jazz, edm, reggae, country, love, party, christmas`);
    }

    const match = results[Math.floor(Math.random() * results.length)][1];
    const sticker = match.stickers[Math.floor(Math.random() * match.stickers.length)];
    api.sendMessage({ sticker }, threadID);
  },
};
