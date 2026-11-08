const ANKI_PORT = 'http://127.0.0.1:8765';

export async function invokeAnki(action, params = {}) {
  try {
    const res = await fetch(ANKI_PORT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  } catch (err) {
    console.error(`AnkiConnect Error [${action}]:`, err);
    throw err;
  }
}

/** Clean Yomitan HTML / Cards for AI context */
export function sanitizeCard(card) {
  const f = card.fields;
  const rawMeaning = f.Meaning?.value || f.Back?.value || '';
  
  // Extract clean text from HTML
  const doc = new DOMParser().parseFromString(rawMeaning, 'text/html');
  const cleanEnglish = doc.body.textContent.trim().split('\n')[0];

  return {
    id: card.cardId,
    expression: f.Expression?.value || f.Front?.value || '',
    reading: f.Reading?.value || '',
    english: cleanEnglish || 'No translation available',
    exampleHtml: f.Image_URI?.value || f.Example?.value || ''
  };
}