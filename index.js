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

// 🎲 Define drop table
const dropTable = [
  { itemdefid: 2001, weight: 75 },   // Common
  { itemdefid: 2002, weight: 30 },   // Uncommon
  { itemdefid: 2003, weight: 10 },   // Rare
  { itemdefid: 2004, weight: 3 },    // Epic
  { itemdefid: 2005, weight: 1 },    // Legendary
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

// 🛡️ Cooldown memory
const rateLimitCache = new Map();
const RATE_LIMIT_SECONDS = 30;

// 🎯 /roll-aura route
app.post('/roll-aura', async (req, res) => {
  const { steamId, authTicket } = req.body;
  if (!steamId || !authTicket) {
    return res.status(400).json({ error: 'Missing steamId or authTicket' });
  }

  const lastRoll = rateLimitCache.get(steamId) || 0;
  const now = Date.now();
  if (now - lastRoll < RATE_LIMIT_SECONDS * 1000) {
    return res.status(429).json({ error: 'Too many rolls. Please wait.' });
  }

  try {
    // ✅ Steam Web API ticket validation (GET)
    const authURL = `https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/` +
                    `?key=${WEB_API_KEY}&appid=${APP_ID}&ticket=${authTicket}`;

    const authResponse = await axios.get(authURL, { timeout: 5000 });
    const result = authResponse.data?.response;

    if (!result || result.steamid !== steamId) {
      console.error('[SteamAuth] Invalid auth ticket:', result);
      return res.status(401).json({ error: 'Invalid Steam auth ticket' });
    }

    // ⏱️ Passed — enforce cooldown
    rateLimitCache.set(steamId, now);

    const itemdefid = pickRandomItemDefId();
    const grantUrl = `https://partner.steam-api.com/IInventoryService/AddItem/v1/` +
                     `?key=${WEB_API_KEY}&appid=${APP_ID}&steamid=${steamId}` +
                     `&itemdefid[0]=${itemdefid}&quantity[0]=1`;

    await axios.post(grantUrl);
    console.log(`[BACKEND] Granted item ${itemdefid} to ${steamId}`);
    return res.status(200).json({ success: true, itemdefid });

  } catch (err) {
    const steamError = err.response?.data?.response || err.response?.data;
    console.error('[ROLL ERROR]', steamError || err.message);
    return res.status(502).json({ error: 'Application failed to respond', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});