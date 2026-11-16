/**
 * Turns a pasted text or a subtitle / lyrics file into a clean list of
 * Japanese lines the learner can study one by one.
 * Supports: .srt, .vtt, .ass/.ssa, .lrc and plain pasted lines.
 * Nothing is uploaded anywhere: the text stays in the browser.
 */

export const MAX_MEDIA_LINES = 500;

const HAS_JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;
const HTML_TAG = /<[^>]*>/g; // <i>, <font ...>
const ASS_TAG = /\{[^}]*\}/g; // {\an8}
const LRC_TIME = /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g;
const LRC_META = /^\[(ti|ar|al|by|offset|length|re|ve|au):.*\]$/i;
const SOUND_NOTE = /^[（(][^）)]*[）)]$/; // （拍手） (music)
const DASH_START = /^[-－–―]\s*/; // two speakers in one subtitle

function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function cleanLine(s) {
  return decode(String(s).replace(HTML_TAG, '').replace(ASS_TAG, ''))
    .replace(/[♪♫♬]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fromSrtVtt(text) {
  const out = [];
  for (const block of text.split(/\n{2,}/)) {
    const rows = block.split('\n').map((r) => r.trim()).filter(Boolean);
    if (rows.length === 0) continue;
    if (/^WEBVTT/i.test(rows[0]) || /^(NOTE|STYLE|REGION)\b/.test(rows[0])) continue;
    const timeAt = rows.findIndex((r) => r.includes('-->'));
    const body = timeAt === -1 ? rows : rows.slice(timeAt + 1); // drops the number and the time row
    let current = null;
    for (const row of body) {
      if (DASH_START.test(row) || current === null) {
        if (current !== null) out.push(current);
        current = row.replace(DASH_START, '');
      } else {
        current += row; // one sentence wrapped over two rows
      }
    }
    if (current !== null) out.push(current);
  }
  return out;
}

function fromAss(text) {
  const out = [];
  for (const row of text.split('\n')) {
    if (!/^Dialogue:/i.test(row)) continue;
    const parts = row.split(',');
    const body = parts.slice(9).join(',');
    out.push(body.replace(/\\N|\\n/g, ''));
  }
  return out;
}

function fromPlain(text) {
  return text
    .split('\n')
    .map((row) => row.trim())
    .filter((row) => row && !LRC_META.test(row))
    .map((row) => row.replace(LRC_TIME, ''));
}

/** Returns [{ id, text }] with duplicates, sound notes and non-Japanese rows removed */
export function parseMediaText(raw, fileName = '') {
  const text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const ext = fileName.split('.').pop().toLowerCase();

  let rows;
  if (ext === 'ass' || ext === 'ssa' || /^\[Script Info\]/m.test(text)) rows = fromAss(text);
  else if (text.includes('-->')) rows = fromSrtVtt(text);
  else rows = fromPlain(text);

  const seen = new Set();
  const lines = [];
  for (const row of rows) {
    const line = cleanLine(row);
    if (!line || SOUND_NOTE.test(line) || !HAS_JAPANESE.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push({ id: lines.length, text: line });
    if (lines.length >= MAX_MEDIA_LINES) break;
  }
  return lines;
}