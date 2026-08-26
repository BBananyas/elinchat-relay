# ElinChat relay

A small Cloudflare Worker that relays chat between the Elin Chat mod and a Discord channel.

It holds the Discord bot token as a Worker secret, so the token never reaches any player's machine. Every player's copy of the mod only ever knows this Worker's own address, and talks to it over plain HTTPS.

## How it works

* `GET /messages` returns the recent messages from the configured Discord channel, as plain JSON with the sender's name already separated from the message text.
* `POST /send` with `{"name": "...", "text": "..."}` posts one line into the channel, since a bot can only ever post as itself and not as a specific player, the player's name is written into the message text.

## Setting up your own Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**. Name it whatever you like.
2. In the sidebar, go to **Bot**, then click **Reset Token** and copy it somewhere safe. Treat this like a password, it never goes in this repo, in the mod, or anywhere public.
3. On the same Bot page, turn on **Message Content Intent** under Privileged Gateway Intents.
4. Go to **OAuth2 > URL Generator**. Under Scopes, check `bot`. Under Bot Permissions, check **View Channel**, **Send Messages**, and **Read Message History**. Copy the generated URL.
5. Open that URL, pick your Discord server, and authorize it. This invites the bot into your server.
6. In Discord, turn on Developer Mode (User Settings > Advanced), then right click the channel you want to relay and choose **Copy Channel ID**.

You now have a bot token and a channel ID.

## Deploying the Worker

1. Sign up for a free [Cloudflare](https://dash.cloudflare.com) account if you don't already have one.
2. Go to **Workers & Pages > Create > Workers > Create Worker**. Give it a name, for example `elinchat-relay`.
3. Once created, click **Edit code**, delete the placeholder content, and paste in the contents of `worker.js` from this repo.
4. Click **Save and deploy**.
5. Back on the Worker's page, go to **Settings > Variables and Secrets**.
6. Add a **Secret** named `DISCORD_TOKEN` with your bot token as the value.
7. Add a **Text** variable named `CHANNEL_ID` with your channel ID as the value.
8. Redeploy if prompted.

Your Worker's address is shown at the top of its page, something like `https://elinchat-relay.<your-subdomain>.workers.dev`. Paste that into the Elin Chat mod's setup screen along with a display name, and it should start working.

## Testing it directly

You can check the relay is working without the mod at all, from a terminal:

```
curl https://your-worker-url.workers.dev/messages
```

```
curl -X POST https://your-worker-url.workers.dev/send \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","text":"hello"}'
```

## A note on the bot showing offline

The bot will always show as offline in your Discord server's member list, and that is expected. This design never opens a live connection to Discord, it only makes one off request at a time when a player's game asks the Worker to. Presence status and the ability to read or send messages through the REST API are unrelated to each other.

## Cost

Cloudflare's free tier covers this comfortably for a small group. As of writing it allows 100,000 requests a day, and the mod polls for new messages every few seconds per player while the chat window's relay tab is set up, which is well under that for a handful of people.
