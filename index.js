const rateLimitCache = new Map(); // steamId => timestamp
const RATE_LIMIT_SECONDS = 30;

app.post('/roll-aura', async (req, res) => {
  const { steamId, authTicket } = req.body;
  if (!steamId || !authTicket) return res.status(400).json({ error: 'Missing steamId or authTicket' });

  // Rate limiting
  const lastRoll = rateLimitCache.get(steamId) || 0;
  const now = Date.now();
  if (now - lastRoll < RATE_LIMIT_SECONDS * 1000) {
    return res.status(429).json({ error: 'Too many rolls. Please wait.' });
  }

  try {
    const authURL = `https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/?key=${WEB_API_KEY}&appid=${APP_ID}&ticket=${authTicket}`;
    const authResponse = await axios.get(authURL);
    const result = authResponse.data?.response;

    if (!result || result.steamid !== steamId) {
      return res.status(401).json({ error: 'Invalid Steam auth ticket' });
    }

    rateLimitCache.set(steamId, now);

    const itemdefid = pickRandomItemDefId();
    const grantUrl = `https://partner.steam-api.com/IInventoryService/AddItem/v1/` +
                     `?key=${WEB_API_KEY}&appid=${APP_ID}&steamid=${steamId}` +
                     `&itemdefid[0]=${itemdefid}&quantity[0]=1`;

    await axios.post(grantUrl);
    console.log(`[BACKEND] Granted item ${itemdefid} to ${steamId}`);
    return res.status(200).json({ success: true, itemdefid });

  } catch (err) {
    console.error('[ROLL ERROR]', err.response?.data || err.message);
    return res.status(500).json({ error: 'Steam validation or grant failed', details: err.message });
  }
});