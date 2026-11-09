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

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Plain text only: removes all tags and the furigana text inside <rt> */
function htmlToPlain(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  doc.querySelectorAll('rt, rp').forEach((el) => el.remove());
  return doc.body.textContent.trim();
}

/** Collects every <ruby> base/reading pair found in some HTML */
function collectRubies(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const pairs = [];
  doc.querySelectorAll('ruby').forEach((r) => {
    const rt = r.querySelector('rt')?.textContent.trim();
    const clone = r.cloneNode(true);
    clone.querySelectorAll('rt, rp').forEach((el) => el.remove());
    const base = clone.textContent.trim();
    if (base && rt) pairs.push({ base, rt });
  });
  return pairs;
}

/** Builds furigana HTML for the headword using ruby found in the card's other fields */
function buildFurigana(expression, plainReading, otherHtml) {
  const pairs = collectRubies(otherHtml);
  let out = '';
  let found = false;
  for (let i = 0; i < expression.length; ) {
    const match = pairs
      .filter((p) => expression.startsWith(p.base, i))
      .sort((a, b) => b.base.length - a.base.length)[0];
    if (match) {
      out += `<ruby>${escapeHtml(match.base)}<rt>${escapeHtml(match.rt)}</rt></ruby>`;
      i += match.base.length;
      found = true;
    } else {
      out += escapeHtml(expression[i]);
      i += 1;
    }
  }
  if (found) return out;
  if (plainReading && plainReading !== expression) {
    return `<ruby>${escapeHtml(expression)}<rt>${escapeHtml(plainReading)}</rt></ruby>`;
  }
  return escapeHtml(expression);
}

/** Clean Yomitan HTML / Cards for AI context */
export function sanitizeCard(card) {
  const f = card.fields;
  const rawMeaning = f.Meaning?.value || f.Back?.value || '';

  // Extract clean text from HTML
  const doc = new DOMParser().parseFromString(rawMeaning, 'text/html');
  const cleanEnglish = doc.body.textContent.trim().split('\n')[0];

  const expression = htmlToPlain(f.Expression?.value || f.Front?.value || '');

  // Some cards keep an example sentence in "Reading", so only trust it if it has no HTML
  const rawReading = f.Reading?.value || '';
  const plainReading = /<[^>]+>/.test(rawReading) ? '' : rawReading.trim();

  const otherHtml = [rawReading, f.Image_URI?.value, f.Example?.value].join(' ');

  return {
    id: card.cardId,
    expression,
    reading: plainReading,
    english: cleanEnglish || 'No translation available',
    exampleHtml: f.Image_URI?.value || f.Example?.value || '',
    displayHtml: buildFurigana(expression, plainReading, otherHtml),
  };
}