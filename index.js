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

// Weighted drop table
const auraChances = [
  { itemDefId: 2001, name: "Common", weight: 75 },     // 1 in 2
  { itemDefId: 2002, name: "Uncommon", weight: 30 },   // 1 in 5
  { itemDefId: 2003, name: "Rare", weight: 7 },        // 1 in 15
  { itemDefId: 2004, name: "Epic", weight: 2 },        // 1 in 50
  { itemDefId: 2005, name: "Legendary", weight: 1 },   // 1 in 150
];

// Weighted random picker
function getWeightedRandomAura() {
  const totalWeight = auraChances.reduce((sum, aura) => sum + aura.weight, 0);
  const roll = Math.random() * totalWeight;
  let running = 0;

  for (let aura of auraChances) {
    running += aura.weight;
    if (roll < running) return aura;
  }

  return auraChances[0]; // Fallback to Common
}

// 🎯 Route: roll and grant aura
app.post('/roll-aura', async (req, res) => {
  const { steamId } = req.body;

  if (!steamId) {
    return res.status(400).json({ error: 'Missing steamId in request body.' });
  }

  const rolledAura = getWeightedRandomAura();
  const grantUrl = `https://partner.steam-api.com/IInventoryService/AddItem/v1/` +
                   `?key=${WEB_API_KEY}&appid=${APP_ID}&steamid=${steamId}` +
                   `&itemdefid[0]=${rolledAura.itemDefId}&quantity[0]=1`;

  try {
    const response = await axios.post(grantUrl);
    console.log(`🎲 Rolled ${rolledAura.name} (ItemDefID ${rolledAura.itemDefId}) for ${steamId}`);
    return res.status(200).json({
      result: 'success',
      aura: rolledAura,
      steam: response.data
    });
  } catch (err) {
    console.error(`[ROLL ERROR]`, err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to grant aura.', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Steam Aura Backend live at http://localhost:${PORT}`);
});