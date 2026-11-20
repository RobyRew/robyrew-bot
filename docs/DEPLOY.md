# Deploy

The process is a Node 26 service. Product commands live in each repo's `bot/` folder and are installed as `file:` dependencies from sibling checkouts under `Documents/Projects/Programing/GitHub`.

Dokploy builds one git repo. Those `file:` links are not in that build. Before a Dokploy deploy, retarget each dependency in `package.json` to the git tag of that repo (`github:RobyRew/<repo>#v0.1.0` with the `bot` export) and push. Nothing in this tree is pushed until that is confirmed.

Env on the VPS, not in git:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_ID`
- `PUBLIC_BASE` — `https://` origin of this service, used for the Logto return and the door page
- `LOGTO_ENDPOINT` `LOGTO_APP_ID` `LOGTO_APP_SECRET`
- `SESSION_ENCRYPTION_KEY` — 64 hex characters. Door linking stays off when this is missing.
- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` — optional. Without them, a Spotify link uses the public oEmbed title and artwork.
- `DATA_DIR` — SQLite and nothing else
- `PORT` — default 8787

`GET /health` returns `ok`. Logs are one JSON line: time, command name, Telegram user id.
