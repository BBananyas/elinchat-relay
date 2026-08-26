// ElinChat relay. Holds the Discord bot token as a Worker secret so it never
// reaches any player's machine. Exposes two plain endpoints:
//
//   GET  /messages         -> recent chat lines from the configured channel
//   POST /send {name,text} -> posts one line to the channel, prefixed with the
//                             sender's in-game name (bots can't post as a real
//                             Discord user, so the name has to go in the text)
//
// Configure two things in the Cloudflare dashboard before this works:
//   - Secret:  DISCORD_TOKEN   (Settings > Variables and Secrets > Add > Secret)
//   - Variable: CHANNEL_ID     (the channel to relay, can be a plain variable)

const DISCORD_API = "https://discord.com/api/v10";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/messages") {
      return handleMessages(url, env);
    }

    if (request.method === "POST" && url.pathname === "/send") {
      return handleSend(request, env);
    }

    return new Response("not found", { status: 404 });
  },
};

async function handleMessages(url, env) {
  const after = url.searchParams.get("after");
  const params = new URLSearchParams({ limit: "50" });
  if (after) {
    params.set("after", after);
  }

  const res = await fetch(
    `${DISCORD_API}/channels/${env.CHANNEL_ID}/messages?${params}`,
    { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } }
  );

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "discord fetch failed", status: res.status }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const raw = await res.json();

  const out = raw
    .slice()
    .reverse()
    .map((m) => {
      const content = m.content ?? "";
      const match = content.match(/^\*\*(.+?)\*\*: ([\s\S]*)$/);

      return {
        id: m.id,
        author: match ? match[1] : (m.author?.username ?? "?"),
        text: match ? match[2] : content,
        ts: m.timestamp,
      };
    });

  return new Response(JSON.stringify(out), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleSend(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const name = String(body.name ?? "").slice(0, 32).trim();
  const text = String(body.text ?? "").slice(0, 1800).trim();

  if (!name || !text) {
    return new Response("name and text required", { status: 400 });
  }

  const res = await fetch(`${DISCORD_API}/channels/${env.CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: `**${name}**: ${text}` }),
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: "discord send failed", status: res.status }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
