# robyrew-bot

One Telegram bot. Each product repo owns its commands in `bot/` and this process loads them. WhatsApp is not connected.

Public commands: `/map`, `/spotify`, `/lesson`, `/verse`, `/tide`, `/ics`, `/ppt`, `/me`, `/repo`.

`/convert` needs a RobyRew @handle. `/door` links each person to their own entrance through a one-time page. The password is not typed into Telegram and is not stored. Unlock asks for the word `UNLOCK`, refuses in a group, and refuses an entrance that is not on that session. The lock pulse itself stays on the Doorline app, because the portal session does not carry it.

Quiet hours are 22:00–08:00 Europe/Madrid. A missed-call alert is the message that still goes out at night. Spotify and calendar digests go out at 08:00.

See `docs/DEPLOY.md` for the VPS env and why the image is not built from this checkout alone.
