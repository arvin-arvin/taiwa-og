import { loadSettings, isAiConfigured } from './settings';

/** Parses JSON even if the model wrapped it in code fences or added extra text */
function parseJsonLoose(text) {
  const cleaned = String(text).replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through to the error below
      }
    }
    throw new Error('The AI did not return valid JSON.');
  }
}

async function postJson(url, headers, body, label) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      `Could not reach ${label}. Check your connection, the URL, and that the service allows browser requests.`
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
        console.error('Provider error details:', data.error);
    const base = typeof data.error === 'string' ? data.error : data.error?.message;
    const raw = data.error?.metadata?.raw;
    const msg = raw ? `${base}: ${typeof raw === 'string' ? raw : JSON.stringify(raw)}` : base;
    throw new Error(msg || `${label} returned an error (${res.status}).`);
  }
  return data;
}

/** Google Gemini, called straight from the browser with the user's own key */
async function requestGemini({ apiKey, model }, systemPrompt, chat) {
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    ...chat.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
  ];

  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': apiKey },
    { contents, generationConfig: { responseMimeType: 'application/json' } },
    'Gemini'
  );
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/** Any service that follows the OpenAI chat format */
async function requestCustom({ baseUrl, apiKey, model }, systemPrompt, chat) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) {
    throw new Error('The custom provider URL must start with https://');
  }
  const messages =
    chat.length > 0
      ? [{ role: 'system', content: systemPrompt }, ...chat]
      : [{ role: 'user', content: systemPrompt }];

  const data = await postJson(
    `${base}/chat/completions`,
    { Authorization: `Bearer ${apiKey}` },
    { model, messages },
    'the custom provider'
  );
  return data.choices?.[0]?.message?.content || '';
}

/** Sends the prompt to whichever provider the user chose in Settings */
async function requestModel(systemPrompt, chat) {
  const settings = loadSettings();
  if (!isAiConfigured(settings)) throw new Error('NO_API_KEY');
  return settings.provider === 'custom'
    ? requestCustom(settings.custom, systemPrompt, chat)
    : requestGemini(settings.gemini, systemPrompt, chat);
}

/**
 * Main AI dispatcher for chat replies
 */
export async function generateRoleplayResponse({
  scenarioContext = "Japanese Restaurant / Cafe",
  messages,
  cards = [],
  jlptLevel,
  formality,
  wordCount = 2,
  systemLang = "en",
}) {
  const activeWords = cards.map((c) => c.expression || c.word).join(", ");

  const explanationInstruction = systemLang === 'ja'
    ? "a brief 1-sentence explanation in natural Japanese (日本語での簡潔な解説)"
    : "a brief 1-sentence English explanation";

  const systemPrompt = `
You are a helpful Japanese language roleplay partner and tutor.
- Current Scenario: ${scenarioContext}.
- JLPT Target Level: ${jlptLevel}.
- Target Formality Level: ${formality}.
- Target Vocabulary List to weave in: [${activeWords}].
- Try to naturally use at least ${wordCount} words from the target vocabulary list.

FIRST, evaluate the user's LAST message only.

Step 1 - Identify the register the user actually used:
- "casual": plain form with no です/ます (e.g. 食べたい, 行く, そうだね, いいよ).
- "polite": です/ます forms (e.g. 食べたいです, 行きます).
- "keigo": honorific or humble expressions (e.g. いらっしゃる, 召し上がる, 申します, いたします, ございます).
- "neutral": a single word or fragment where no register is visible.

Step 2 - Compare it with the target formality: ${formality}
- Target "Casual (タメ口)": casual is expected. Do NOT correct valid casual Japanese into polite form.
- Target "Teineigo (丁寧語 - Polite)": polite is expected. A casual message is a MISTAKE.
- Target "Keigo (敬語 - Honorific/Humble)": keigo is expected. A casual message is a MISTAKE. A merely polite message (です/ます without honorific or humble forms) should also be flagged, with a gentler explanation.
- If the register does not match the target, "hasIssues" MUST be true.

Step 3 - Also check for real grammar errors (wrong particle, bad conjugation, unnatural wording). A grammar error also makes "hasIssues" true.

If "hasIssues" is true, "correctedText" must be the user's own sentence rewritten in the target formality (${formality}), changing as little as possible. If "hasIssues" is false, "correctedText" is an empty string.

Examples:
- Target Teineigo, user says "ラーメンが食べたい" -> userFormality "casual", hasIssues true, correctedText "ラーメンが食べたいです".
- Target Casual, user says "明日は暇だよ" -> userFormality "casual", hasIssues false.

THEN reply in character as the other person in the scenario, at the target JLPT level.

CRITICAL OUTPUT FORMAT:
You MUST respond strictly in valid raw JSON without markdown formatting, with the keys in exactly this order:
{
  "userFormality": "casual, polite, keigo or neutral",
  "userFeedback": {
    "hasIssues": true or false,
    "correctedText": "Corrected Japanese sentence, or an empty string",
    "explanation": "${explanationInstruction}"
  },
  "text": "Plain Japanese sentence for AI response",
  "translation": "Natural English translation of AI response",
  "furiganaHtml": "AI response formatted with native HTML <ruby> word <rt>reading</rt></ruby> tags",
  "usedWords": ["Target words used in AI response"]
}
`;

  const MAX_HISTORY = 25;
  const chat = messages.slice(-MAX_HISTORY).map((m) => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
  }));
  // The history should start with the AI's turn so the roles alternate
  while (chat.length > 1 && chat[0].role === "user") chat.shift();
  console.log('History sent:', chat.length, 'messages');

  try {
    const parsed = parseJsonLoose(await requestModel(systemPrompt, chat));
    console.log('AI reply:', parsed);
    if (!parsed || typeof parsed.text !== 'string') {
      throw new Error('The AI reply was missing its text.');
    }
        // Code-side check: don't rely on the model to flag a register mismatch
    const used = String(parsed.userFormality || '').toLowerCase();
    const target = String(formality);
    const isKeigoTarget = /keigo/i.test(target);
    const isPoliteTarget = !isKeigoTarget && /teineigo|polite/i.test(target);
    const mismatch =
      (isPoliteTarget && used === 'casual') ||
      (isKeigoTarget && (used === 'casual' || used === 'polite'));

    let userFeedback = parsed.userFeedback || null;
    if (mismatch && !userFeedback?.hasIssues) {
      userFeedback = {
        hasIssues: true,
        correctedText: userFeedback?.correctedText || '',
        explanation:
          userFeedback?.explanation ||
          (systemLang === 'ja'
            ? `この場面では${isKeigoTarget ? '敬語' : '丁寧語'}を使いましょう。`
            : `This scenario expects ${isKeigoTarget ? 'keigo' : 'polite (です/ます) speech'}, but your message was ${used}.`),
      };
    }

    return {
      text: parsed.text,
      translation: parsed.translation || '',
      furiganaHtml: parsed.furiganaHtml || '',
      usedWords: Array.isArray(parsed.usedWords) ? parsed.usedWords : [],
      userFeedback,
    };
  } catch (err) {
    console.error("AI request failed:", err);
    if (err.message === 'NO_API_KEY') {
      return {
        text: "設定でAPIキーを追加してください。",
        translation: "Open Settings and add your API key to start chatting.",
        furiganaHtml: "",
        usedWords: [],
        userFeedback: null,
      };
    }
    return {
      text: "すみません、AIエラーが発生しました。",
      translation: `API Error: ${err.message}`,
      furiganaHtml: "",
      usedWords: [],
      userFeedback: null,
    };
  }
}

/**
 * Generates 3 candidate responses in Japanese
 */
export async function generateReplyHints({
  scenarioContext = "General Practice",
  messages = [],
  cards = [],
  jlptLevel = "N4",
  formality = "Polite",
}) {
  const activeVocabList = cards.map((c) => `${c.expression || c.word} (${c.english || c.meaning})`).join(', ');
  const recentHistory = messages.slice(-4).map((m) => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');

  const systemPrompt = `You are a Japanese conversation tutor assistant.
Given the current roleplay scenario and conversation history, generate EXACTLY 3 natural candidate Japanese replies for the user to say next.

RULES:
1. Target JLPT Level: ${jlptLevel}. Use grammar & vocabulary suitable for this level.
2. Formality Mode: ${formality}. Strictly follow this formality style.
3. Target Anki Vocabulary: Prioritize incorporating these vocabulary words if applicable: [${activeVocabList}].
4. Provide a variety of responses (e.g., 1 direct/simple response, 1 asking a follow-up question, 1 detailed response).
5. Output ONLY valid JSON array in the exact format:
[
  {
    "japanese": "日本語の返信",
    "reading": "にほんごのへんしん",
    "english": "English translation",
    "explanation": "Brief explanation of why this fits or which vocab/grammar it uses"
  }
]`;

  const userPrompt = `Scenario: ${scenarioContext}
Recent Conversation:
${recentHistory}

Generate 3 Japanese candidate reply options for the user. Return JSON array ONLY.`;

  try {
    const raw = await requestModel(`${systemPrompt}\n\n${userPrompt}`, []);
    const hints = parseJsonLoose(raw);
    return Array.isArray(hints) ? hints.slice(0, 3) : [];
  } catch (err) {
    console.error("Failed to generate reply hints:", err);
    return [];
  }
}