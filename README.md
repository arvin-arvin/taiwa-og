# Taiwa (対話)

A web app for practising Japanese conversation with an AI roleplay partner. It pulls vocabulary from your own Anki decks, so you practise the words you are already learning.

## Features

- Roleplay scenarios (cafe, convenience store, hotel, directions, chatting with a friend), plus custom scenarios
- JLPT level (N5–N1) and formality (casual, teineigo, keigo) controls
- Target vocabulary from Anki through AnkiConnect: random, top of deck, or hand-picked cards, with furigana
- Grammar and formality feedback on your replies, and reply hints
- Furigana and English translation on AI messages, with text-to-speech
- English and Japanese interface, dark and light themes

## Tech stack

- React 19 + Vite
- Vercel serverless function (`api/gemini.js`) that keeps the Gemini API key on the server
- Google Gemini models (3.5 Flash-Lite, 3.6 Flash)
- AnkiConnect (Anki add-on), called from the browser
- Settings and custom scenarios are stored in the browser (`localStorage`)

## Running it

```bash
npm install
npm run dev
```

`npm run dev` serves the interface only. The AI calls go through `/api/gemini`, which is a Vercel function, so to chat locally run the project with the Vercel CLI (`vercel dev`) and set `GEMINI_API_KEY` in a local `.env` file.

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Vercel project settings (server only) | Gemini API key |

Never put API keys in variables that start with `VITE_`, because Vite copies those into the code sent to every visitor.

## Anki setup

1. Install the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on and keep Anki open while using Taiwa.
2. In Anki, go to Tools → Add-ons → AnkiConnect → Config and add your site's address to `webCorsOriginList`, for example:

```json
"webCorsOriginList": [
    "http://localhost",
    "https://your-site.vercel.app"
]
```

3. Restart Anki. Your browser may ask permission to connect to apps on your device. Allow it.

## Deployment

The app is deployed on Vercel from the `main` branch. Every push to `main` redeploys it. Add `GEMINI_API_KEY` under Settings → Environment Variables before deploying.