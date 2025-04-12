const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WEB_API_KEY = process.env.STEAM_WEB_API_KEY;
const APP_ID = process.env.STEAM_APP_ID;

// 🎲 Aura drop odds
const dropTable = [
  { itemdefid: 2001, weight: 75 },   // Common
  { itemdefid: 2002, weight: 30 },   // Uncommon
  { itemdefid: 2003, weight: 10 },   // Rare
  { itemdefid: 2004, weight: 3 },    // Epic
  { itemdefid: 2005, weight: 1 }     // Legendary
];

function pickRandomItemDefId() {
  const totalWeight = dropTable.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = Math.random() * totalWeight;
  let cumulative = 0;

  for (const entry of dropTable) {
    cumulative += entry.weight;
    if (roll < cumulative) return entry.itemdefid;
  }

  return dropTable[0].itemdefid;
}

// ⏳ Rate limiting in-memory
const rateLimitCache = new Map();
const RATE_LIMIT_SECONDS = 5;

app.post('/roll-aura', async (req, res) => {
  const { steamId, authTicket } = req.body;

  if (!steamId || !authTicket) {
    return res.status(400).json({ error: 'Missing steamId or authTicket' });
  }

  const now = Date.now();
  const lastRoll = rateLimitCache.get(steamId) || 0;
  const elapsedSeconds = (now - lastRoll) / 1000;

  if (elapsedSeconds < RATE_LIMIT_SECONDS) {
    const waitTime = Math.ceil(RATE_LIMIT_SECONDS - elapsedSeconds);
    return res.status(429).json({ error: `Please wait ${waitTime}s before rolling again.` });
  }

  try {
    console.log(`[AUTH] Validating ticket for ${steamId}...`);

    const steamAuthUrl = 'https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/';
    const authResponse = await axios.get(steamAuthUrl, {
      params: {
        key: WEB_API_KEY,
        appid: APP_ID,
        ticket: authTicket
      },
      timeout: 5000
    });

    const data = authResponse?.data?.response?.params;

    if (!data || data.result !== 'OK') {
      console.error('[SteamAuth] Invalid result:', authResponse.data);
      return res.status(401).json({ error: 'Steam rejected auth ticket' });
    }

    if (data.steamid !== steamId) {
      console.error(`[SteamAuth] Mismatch: expected ${steamId}, got ${data.steamid}`);
      return res.status(401).json({ error: 'Steam ID does not match ticket' });
    }

    rateLimitCache.set(steamId, now);

    const itemdefid = pickRandomItemDefId();
    const grantUrl = `https://partner.steam-api.com/IInventoryService/AddItem/v1/` +
                     `?key=${WEB_API_KEY}&appid=${APP_ID}&steamid=${steamId}` +
                     `&itemdefid[0]=${itemdefid}&quantity[0]=1`;

    await axios.post(grantUrl);
    console.log(`[GRANT] Gave item ${itemdefid} to ${steamId}`);

    return res.status(200).json({ success: true, itemdefid });

  } catch (err) {
    const message = err.response?.data || err.message;
    console.error('[ROLL ERROR]', message);
    return res.status(502).json({ error: 'Steam validation failed', details: message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});