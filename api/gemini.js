const ALLOWED_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { model, payload } = req.body ?? {};
  if (!ALLOWED_MODELS.includes(model) || typeof payload !== "object") {
    return res.status(400).json({ error: "Bad request" });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server key not set" });
  }

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await upstream.json();
  return res.status(upstream.status).json(data);
}