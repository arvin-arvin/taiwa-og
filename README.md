# Taiwa (話) – Japanese Conversation Practice with Anki

Taiwa is a web app for practising Japanese conversation with an AI roleplay partner. It pulls vocabulary from your own Anki decks through AnkiConnect, so the words you are already memorising get used in real conversation.

Built for Toi Ohomai COMP.6207 / COMP.6208.

Live site: https://taiwa-og.vercel.app/

## Features

- **Scenario-based chat.** Cafe, convenience store, hotel, directions, casual chat, and your own custom scenarios.
- **Adjustable difficulty.** Choose a JLPT level (N5–N1) and a formality register (casual, teineigo, keigo).
- **Anki vocabulary.** Practise a random set, the top of a deck, or hand-picked cards. Used words are tracked.
- **Grammar and formality feedback.** If your message uses the wrong register or has a grammar error, the app shows a corrected sentence and a short explanation.
- **Reply hints.** Ask for three example replies at your level.
- **Reading aids.** Furigana, English translation, kanji and target-word highlighting. Each can be always on, shown on hover, or hidden.
- **Text to speech** for any message.
- **Custom scenarios.** Create, edit, delete, export and import them as JSON.
- **Saved chat.** Your conversation and settings survive a page refresh.
- **Responsive layout** with a collapsible sidebar, dark and light themes, and English or Japanese interface text.

## How it works

Taiwa has no server and no login. Everything runs in your browser:

- **AI:** you bring your own API key (free Gemini key from <https://aistudio.google.com/apikey>), or any OpenAI-compatible endpoint in Settings. Requests go directly from your browser to the provider.
- **Anki:** the app talks to AnkiConnect on your own computer (`http://127.0.0.1:8765`).
- **Storage:** your settings, API key, chat and custom scenarios are saved in your browser's local storage. They never reach any server run by this project.

Because keys live in the browser, use a key you can revoke, and don't use the app on a shared computer.

## Getting started

1. Open the site and go to **Settings > System**.
2. Choose Gemini, paste your API key and pick a model. (Or choose Custom and enter an OpenAI-compatible base URL, key and model name. The service must allow browser requests.)
3. Open a scenario and start chatting.

### Connecting Anki (optional)

1. Install Anki and the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on, and keep Anki open.
2. In Anki, open **Tools > Add-ons > AnkiConnect > Config** and add the site's address to `webCorsOriginList`:

```json
{
  "webCorsOriginList": ["http://localhost", "https://YOUR-SITE.vercel.app"]
}
```

3. Restart Anki and reload Taiwa. If the browser asks for permission to access devices on your local network, allow it.

Without Anki you can still chat. You just won't get deck vocabulary.

Cards work best when the note has an expression field and a reading or meaning field (for example, notes created with Yomitan).

## Run it locally

```bash
npm install
npm run dev
```

Then open <http://localhost:5173> (add `http://localhost:5173` to AnkiConnect's `webCorsOriginList` too). No environment variables are needed.

## Deploy

The project is a plain Vite + React app. On Vercel, import the repository and use the defaults (build command `npm run build`, output directory `dist`). No environment variables or server functions are required.

## Custom scenario files

Scenarios export as JSON:

```json
{
  "app": "taiwa",
  "version": 1,
  "scenarios": [
    {
      "title": { "en": "Returning an item", "ja": "返品" },
      "description": { "en": "Return a shirt at a clothing store" },
      "supportedFormalities": ["Teineigo (丁寧語 - Polite)"],
      "initialMessage": {
        "text": "いらっしゃいませ。",
        "translation": "Welcome."
      },
      "icon": "Store"
    }
  ]
}
```

Imports are checked and cleaned. Invalid entries are skipped, and any HTML in a greeting is stripped down to furigana tags.

## Tech stack

React 19, Vite, plain CSS, lucide-react icons, AnkiConnect, Google Gemini API (or an OpenAI-compatible endpoint), Web Speech API for text to speech, hosted on Vercel.

## Known limitations

- Anki integration needs a desktop computer running Anki, so it does not work on phones.
- Target-word highlighting matches the dictionary form shown on the card, so conjugated forms are not highlighted.
- Free AI tiers can be rate-limited or overloaded.
- Browser storage can be cleared by the browser. A backup and restore feature is planned.

## Planned

Click-to-define with add-to-Anki, voice input, speech speed control, an end-of-session report, richer scenarios (persona and per-scenario vocabulary), Anki note-type mapping, and data backup and restore.