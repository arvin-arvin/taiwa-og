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


/**
 * Explains one line from an anime subtitle or a song lyric.
 * formality: 'casual' | 'formal' | 'respectful'  (plain / です・ます / keigo)
 */
const MEDIA_STYLES = {
  casual: 'casual plain form (タメ口), no です/ます',
  formal: 'polite form (丁寧語), です/ます',
  respectful: 'respectful and humble keigo (敬語), using 尊敬語 and 謙譲語 where natural',
};

export async function explainMediaLine({
  line,
  before = '',
  after = '',
  formality = 'formal',
  jlptLevel = 'N4',
  systemLang = 'en',
}) {
  const style = MEDIA_STYLES[formality] || MEDIA_STYLES.formal;
  const lang = systemLang === 'ja' ? 'natural, simple Japanese (日本語)' : 'English';

  const systemPrompt = `
You are a Japanese tutor. A learner at JLPT ${jlptLevel} is studying one line taken from anime subtitles or a song lyric.

Line to explain: 「${line}」
${before ? `Line before it (context only): 「${before}」` : ''}
${after ? `Line after it (context only): 「${after}」` : ''}

Tasks:
1. Translate the line into natural English.
2. Say which register the original line uses: "casual", "polite", "keigo" or "neutral".
3. Estimate the JLPT level needed to understand the whole line: "N5", "N4", "N3", "N2" or "N1".
4. Rewrite the line in this style: ${style}. Keep the meaning. If the line is already in that style, return it unchanged.
5. List the important words (at most 8) with reading, short English meaning and JLPT level. Use the dictionary form.
6. Explain the grammar patterns (at most 4) in plain words.
7. Add one short note about nuance, tone or culture, if there is anything worth saying. Otherwise use an empty string.

Write every explanation in ${lang}. The line may be a fragment or poetic; do not invent missing words.

CRITICAL OUTPUT FORMAT: respond with valid raw JSON only, no markdown, exactly these keys:
{
  "furiganaHtml": "the original line with <ruby>kanji<rt>reading</rt></ruby> tags",
  "translation": "English translation",
  "register": "casual, polite, keigo or neutral",
  "jlpt": "N5, N4, N3, N2 or N1",
  "rewrite": { "text": "line in the requested style", "furiganaHtml": "same with ruby tags" },
  "words": [ { "word": "...", "reading": "...", "meaning": "...", "jlpt": "N5, N4, N3, N2 or N1" } ],
  "grammar": [ { "pattern": "...", "explanation": "..." } ],
  "note": "short note or an empty string"
}
`;

  const parsed = parseJsonLoose(await requestModel(systemPrompt, []));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The AI reply could not be read.');
  }

  const str = (v) => (typeof v === 'string' ? v : '');
  const level = (v) => {
    const m = String(v || '').toUpperCase().match(/N[1-5]/);
    return m ? m[0] : '';
  };

  return {
    furiganaHtml: str(parsed.furiganaHtml),
    translation: str(parsed.translation),
    register: str(parsed.register).toLowerCase(),
    jlpt: level(parsed.jlpt),
    rewrite: {
      text: str(parsed.rewrite?.text) || line,
      furiganaHtml: str(parsed.rewrite?.furiganaHtml),
    },
    words: (Array.isArray(parsed.words) ? parsed.words : []).slice(0, 8).map((w) => ({
      word: str(w.word),
      reading: str(w.reading),
      meaning: str(w.meaning),
      jlpt: level(w.jlpt),
    })).filter((w) => w.word),
    grammar: (Array.isArray(parsed.grammar) ? parsed.grammar : []).slice(0, 4).map((g) => ({
      pattern: str(g.pattern),
      explanation: str(g.explanation),
    })).filter((g) => g.pattern),
    note: str(parsed.note),
  };
}


/**
 * Makes quiz questions from the learner's Anki words or from media lines.
 * kind: 'mcq' | 'fill' | 'mixed'
 * source: { type: 'anki', cards: [{expression, reading, english}] } or { type: 'media', lines: ['...'] }
 */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cleanQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const explanation = str(q.explanation);

  if (q.type === 'mcq') {
    const options = (Array.isArray(q.options) ? q.options : []).map(str).filter(Boolean);
    const answerIndex = Number.parseInt(q.answer, 10);
    if (!str(q.question)) return null;
    if (options.length < 3 || options.length > 5 || new Set(options).size !== options.length) return null;
    if (!(answerIndex >= 0 && answerIndex < options.length)) return null;
    const correct = options[answerIndex];
    const mixed = shuffle(options); // the model tends to favour one position
    return {
      type: 'mcq',
      question: str(q.question),
      options: mixed,
      answer: mixed.indexOf(correct),
      explanation,
    };
  }

  if (q.type === 'fill') {
    const sentence = str(q.sentence).replace(/_{2,}|＿+|\[\s*\]|（\s*）|\(\s*\)/g, '＿＿');
    const answer = str(q.answer);
    if (!sentence.includes('＿＿') || !answer) return null;
    return {
      type: 'fill',
      sentence,
      answer,
      reading: str(q.reading),
      alternatives: (Array.isArray(q.alternatives) ? q.alternatives : []).map(str).filter(Boolean).slice(0, 4),
      hint: str(q.hint),
      explanation,
    };
  }
  return null;
}

export async function generateQuiz({
  source,
  kind = 'mixed',
  count = 5,
  jlptLevel = 'N4',
  systemLang = 'en',
}) {
  const lang = systemLang === 'ja' ? 'simple Japanese (日本語)' : 'English';

  let material;
  if (source.type === 'media') {
    const lines = source.lines.slice(0, 15).map((l) => `- 「${l}」`).join('\n');
    material = `The learner is studying these lines from anime subtitles or song lyrics:\n${lines}\nEvery question must be about one of these lines (its vocabulary, grammar or meaning). Quote the line only when the question needs it.`;
  } else {
    const words = source.cards
      .slice(0, 20)
      .map((c) => `- ${c.expression}${c.reading ? ` (${c.reading})` : ''}: ${c.english || ''}`)
      .join('\n');
    material = `The learner's own Anki vocabulary:\n${words}\nEvery question must test one of these words. Use each word at most twice.`;
  }

  const kindRule =
    kind === 'mcq'
      ? `Make ${count} multiple-choice questions only.`
      : kind === 'fill'
        ? `Make ${count} fill-in-the-blank questions only.`
        : `Make ${count} questions: about half multiple-choice and half fill-in-the-blank.`;

  const systemPrompt = `
You are a Japanese teacher writing a short quiz for a learner at JLPT ${jlptLevel}.

${material}

${kindRule}
Keep every sentence at or below JLPT ${jlptLevel} in grammar and vocabulary, except for the target word itself.

Question formats:
- Multiple choice: {"type":"mcq","question":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}
  4 options, exactly one correct, "answer" is the 0-based index of the correct option. Wrong options must be plausible but clearly wrong. Ask for a meaning, a reading, or the right word for a sentence.
- Fill in the blank: {"type":"fill","sentence":"今日は＿＿が降っています。","answer":"雨","reading":"あめ","alternatives":[],"hint":"English meaning of the sentence","explanation":"..."}
  The sentence has exactly one blank written as ＿＿. "answer" is the word that fills the blank (the form that fits the sentence). "reading" is its hiragana reading. Aim for a blank with only one natural answer; if another word would also fit naturally, list it in "alternatives" (otherwise use an empty list).
  Write "question" for multiple choice in ${lang} unless it quotes Japanese. Write "hint" and "explanation" in ${lang}; keep explanations to one short sentence.

CRITICAL OUTPUT FORMAT: valid raw JSON only, no markdown: {"questions":[ ... ]}
`;

  const parsed = parseJsonLoose(await requestModel(systemPrompt, []));
  const list = Array.isArray(parsed) ? parsed : parsed?.questions;
  const questions = (Array.isArray(list) ? list : []).map(cleanQuestion).filter(Boolean).slice(0, count);
  if (questions.length === 0) throw new Error('The AI did not return any usable questions. Try again.');
  return questions;
}