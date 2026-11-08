/**
 * Call xKiro (Qwen) through our own server function
 */
async function callXkiro(model, systemPrompt, messages) {
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    })),
  ];

  const res = await fetch("/api/xkiro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: formattedMessages }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || data.error || "xKiro API Error");
  }

  const rawText = data.choices[0].message.content;
  const cleanJson = rawText.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleanJson);
}

/**
 * Call Google Gemini through our own server function
 */
async function callGemini(model, systemPrompt, messages) {
  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    ...messages.map((m) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
  ];

  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      payload: {
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      },
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || data.error || "Gemini API Error");
  }

  const rawText = data.candidates[0].content.parts[0].text;
  const cleanJson = rawText.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleanJson);
}

/**
 * Main AI dispatcher for chat replies
 */
export async function generateRoleplayResponse({
  selectedModel = "qwen/qwen3.5-flash:free",
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

USER INPUT EVALUATION RULES:
1. FORMALITY TARGET: ${formality}
   - If Formality is "Casual (タメ口)": The user IS EXPECTED to speak in casual/plain form (e.g., 「〜だ」「〜しよう」「〜じゃない？」). DO NOT convert or correct valid casual Japanese into polite (です/ます) form!
   - If Formality is "Teineigo (丁寧語 - Polite)": The user should use polite form (です/ます).
   - If Formality is "Keigo (敬語 - Honorific/Humble)": The user should use appropriate honorific/humble expressions.

2. GRAMMAR & NATURALNESS CHECK:
   - Only set "hasIssues" to true if there is an actual grammatical error (wrong particle, bad conjugation, or mismatched formality level).
   - If "hasIssues" is true, the "correctedText" MUST preserve the target formality (${formality}).

CRITICAL OUTPUT FORMAT:
You MUST respond strictly in valid raw JSON without markdown formatting:
{
  "text": "Plain Japanese sentence for AI response",
  "translation": "Natural English translation of AI response",
  "furiganaHtml": "AI response formatted with native HTML <ruby> word <rt>reading</rt></ruby> tags",
  "usedWords": ["Target words used in AI response"],
  "userFeedback": {
    "hasIssues": true,
    "correctedText": "Corrected Japanese sentence",
    "explanation": "${explanationInstruction}"
  }
}
`;

  try {
    if (selectedModel.startsWith("qwen/")) {
      return await callXkiro(selectedModel, systemPrompt, messages);
    } else {
      return await callGemini(selectedModel, systemPrompt, messages);
    }
  } catch (err) {
    console.error(`AI Model Request Failed (${selectedModel}):`, err);
    return {
      text: "すみません、AIエラーが発生しました。",
      translation: `API Error: ${err.message}`,
      furiganaHtml: "すみません、エラーが<ruby>発<rt>はつ</rt></ruby><ruby>生<rt>せい</rt></ruby>しました。",
      usedWords: [],
      userFeedback: null,
    };
  }
}

/**
 * Generates 3 candidate responses in Japanese based on active model (xKiro or Gemini)
 */
export async function generateReplyHints({
  selectedModel = "qwen/qwen3.5-flash:free",
  scenarioContext = "General Practice",
  messages = [],
  cards = [],
  jlptLevel = "N4",
  formality = "Polite",
  systemLang = 'en',
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
        let rawText = '';

    if (selectedModel.startsWith('qwen/')) {
      const res = await fetch("/api/xkiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message || data.error || "xKiro API Error");
      rawText = data.choices?.[0]?.message?.content || '';
    } else {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          payload: {
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          },
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message || data.error || "Gemini API Error");
      rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const cleanJson = rawText.replace(/```json\n?|\n?```/g, '').trim();
    const hints = JSON.parse(cleanJson);
    return Array.isArray(hints) ? hints.slice(0, 3) : [];
  } catch (err) {
    console.error("Failed to generate reply hints:", err);
    return [];
  }
}