const ALLOWED_MODELS = ["qwen/qwen3.5-flash:free"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { model, messages } = req.body ?? {};
  if (!ALLOWED_MODELS.includes(model) || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Bad request" });
  }
  if (!process.env.XKIRO_API_KEY) {
    return res.status(500).json({ error: "Server key not set" });
  }

  const upstream = await fetch("https://api.xkiro.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XKIRO_API_KEY}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  const data = await upstream.json();
  return res.status(upstream.status).json(data);
}