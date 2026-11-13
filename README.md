# Player-info relay (UID -> nickname, level, region)

Why a relay? A web page cannot read data from another website (browser security rule). The relay runs on
Cloudflare's servers, asks the player-info service, and hands your store clean JSON in about 1-2 seconds.

## 1. Find the endpoint (2 minutes)
1. Open https://chamaa.dev/info in Chrome on a computer.
2. Press **F12 -> Network** tab -> tick **Fetch/XHR**.
3. Type a UID and press **Get Info**.
4. A request appears (name like `info?uid=...`). Click it -> copy its **Request URL**; look at **Response** to confirm it
   contains the nickname, level and region.
   Replace the UID in the URL with `{uid}` and paste it as `UPSTREAM_URL` in `player-info-worker.js`.
5. Please ask the owner (Telegram @ChamaaDev) if automated use is OK — it is a free service run by one person,
   and they may offer a proper API / key (then put the key in the Worker as secret `UPSTREAM_KEY`).

## 2. Deploy the Worker (5 minutes, free)
1. https://dash.cloudflare.com -> **Workers & Pages -> Create -> Create Worker** -> name it e.g. `sakindu-player-info` -> Deploy.
2. **Edit code** -> delete everything -> paste `player-info-worker.js` -> **Deploy**.
3. Set `ALLOWED_ORIGINS` to your real site address(es), e.g. `['https://sakindustore.com']`.
4. Copy the Worker URL (`https://sakindu-player-info.<you>.workers.dev`).

## 3. Connect the store
Open `player-info.js` and set `PLAYER_INFO_URL` to the Worker URL. Upload the site. Done.

## Testing / debugging
Open `https://<worker-url>/?uid=123456789` in the browser. You should see
`{"ok":true,"uid":"...","nickname":"...","level":..,"region":".."}`.
If you get `not_found` or `unavailable`, add a Worker variable `DEBUG` = `1`, reload that URL, and the `detail` field
shows what the service returned (then adjust `NICK_KEYS / LEVEL_KEYS / REGION_KEYS` at the top of the Worker).
