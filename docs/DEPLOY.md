# Run it on the VPS

The process is a long-lived Node program. It holds a SQLite file and a Telegram long poll. That runs on the IONOS box under Dokploy. A Cloudflare Worker does not keep that process between requests, so this build is the VPS one.

Dokploy builds from GitHub. The image clones the public product repos during `docker build` and keeps their `bot/` folders. `bibletype` is private and `biserica` has no remote, so those two bot slices are copied from `image/` in this repo.

## DNS

Add an A record:

`bot.robyrew.com` → `94.143.138.233`

## Dokploy

The Dokploy UI is on the tailnet (`https://dokploy.cosmincalin.es` is webhooks only). In the UI:

1. Create an application from `RobyRew/robyrew-bot`, branch `main`, compose file `docker-compose.yml`.
2. Put these in the environment screen, not in git:

- `TELEGRAM_BOT_TOKEN` from BotFather
- `TELEGRAM_ADMIN_ID` your numeric Telegram id
- `PUBLIC_BASE` `https://bot.robyrew.com`
- `SESSION_ENCRYPTION_KEY` 64 hex characters (`openssl rand -hex 32`)
- `LOGTO_ENDPOINT` `https://auth.robyrew.com`
- `LOGTO_APP_ID` and `LOGTO_APP_SECRET` for a Logto app whose redirect is `https://bot.robyrew.com/login/callback`
- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` optional, for playlist rows

3. Deploy. The bot starts polling when `TELEGRAM_BOT_TOKEN` is set. `https://bot.robyrew.com/health` returns `ok`.

SQLite stays in the `robyrew-bot-data` volume. A redeploy does not wipe chats, timers, or door sessions.
