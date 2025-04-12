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

// Define drop odds
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

  return dropTable[0].itemdefid; // Fallback
}

app.post('/roll-aura', async (req, res) => {
  const { steamId } = req.body;
  if (!steamId) return res.status(400).json({ error: 'Missing steamId' });

  const itemdefid = pickRandomItemDefId();

  const url = `https://partner.steam-api.com/IInventoryService/AddItem/v1/` +
              `?key=${WEB_API_KEY}&appid=${APP_ID}&steamid=${steamId}` +
              `&itemdefid[0]=${itemdefid}&quantity[0]=1`;

  try {
    const response = await axios.post(url);
    console.log(`[BACKEND] Granted item ${itemdefid} to ${steamId}`);
    return res.status(200).json({ success: true, itemdefid });
  } catch (err) {
    console.error(err.response?.data || err.message);
    return res.status(500).json({ error: 'Grant failed', details: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));